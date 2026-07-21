"""Parse EventLink "Standings by Rank" PDF exports into structured results.

The exports are print-to-PDF documents whose text layer is "flowed": metadata fields run
together with no line breaks and the standings rows are padded with non-breaking spaces.
So we flatten the whole text to single-spaced ASCII-ish and pull fields out with regexes,
keying each row off its five trailing integers (Pod, Points, OMW%, GW%, OGW%).
"""

import re
from dataclasses import dataclass
from datetime import date
from io import BytesIO

from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mm_ladder.errors import BadRequestError, ConflictError
from mm_ladder.interface.pdf_import import ImportCommitParticipant, ImportCommitRequest
from mm_ladder.models.player import Player
from mm_ladder.models.tournament import Tournament
from mm_ladder.models.tournament_participant import TournamentParticipant
from mm_ladder.schemas.pdf_import import ImportCommitResult, ImportPreview, ImportPreviewParticipant
from mm_ladder.scoring import POINTS_TO_WLD, wld_for_points
from mm_ladder.services.audit import AuditRecorder
from mm_ladder.services.player_matching import find_matching_player
from mm_ladder.services.season import SeasonService

REQUIRED_ROUNDS = 3

_EVENT_RE = re.compile(r"Event:\s*(?P<title>.+?)\s*\((?P<id>\d+)\)")
_POD_RE = re.compile(r"Pod\s*(\d+)", re.IGNORECASE)
_DATE_RE = re.compile(r"Event Date:\s*(\d{2})/(\d{2})/(\d{4})")
_VENUE_RE = re.compile(r"Event Information:\s*(?P<venue>.+?)\s+Opponents\b")
_ROUNDS_RE = re.compile(r"Round\s+(\d+)\s+Standings by Rank")
# A standings row: rank, name, then Pod, Points, OMW%, GW%, OGW% (five integers).
_ROW_RE = re.compile(r"(?P<rank>\d+)\s+(?P<name>.+?)\s+(?P<pod>\d+)\s+(?P<points>\d+)\s+\d+\s+\d+\s+\d+")


@dataclass(frozen=True)
class ParsedRow:
    rank: int
    raw_name: str
    points: int


@dataclass(frozen=True)
class ParsedPdf:
    eventlink_id: str
    pod_number: int
    held_on: date
    venue: str | None
    rounds: int
    rows: list[ParsedRow]


def _flatten(text: str) -> str:
    """Non-breaking spaces to spaces, collapse runs of whitespace to one space."""
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def tidy_name(raw: str) -> str:
    """Collapse whitespace (incl. the PDF's non-breaking spaces) and trim.

    Emoji and punctuation are kept — they're valid in a display name/alias, and name
    matching folds them away anyway. "Damon Merry ☠" and "Dylan Tevardy-O'Neil" are
    preserved, just de-padded.
    """
    return re.sub(r"\s+", " ", raw.replace("\xa0", " ")).strip()


def _extract_text(data: bytes) -> str:
    try:
        reader = PdfReader(BytesIO(data))
        pages = [page.extract_text() or "" for page in reader.pages]
    except Exception as exc:  # pragma: no cover - pypdf raises many concrete types
        raise BadRequestError(f"Could not read the PDF: {exc}") from None
    text = "\n".join(pages)
    if not text.strip():
        raise BadRequestError("The PDF has no extractable text — it may be a scan or image.")
    return text


def parse_standings_pdf(data: bytes) -> ParsedPdf:
    """Parse an EventLink 'Standings by Rank' PDF. Raises BadRequestError on any mismatch."""
    return parse_standings_text(_extract_text(data))


def parse_standings_text(raw_text: str) -> ParsedPdf:
    """Parse already-extracted standings text (split out so it's unit-testable without a PDF)."""
    flat = _flatten(raw_text)

    event = _EVENT_RE.search(flat)
    if not event:
        raise BadRequestError("Not an EventLink standings report (no 'Event: … (id)' header found).")
    eventlink_id = event.group("id")
    pod_match = _POD_RE.search(event.group("title"))
    pod_number = int(pod_match.group(1)) if pod_match else 1

    date_match = _DATE_RE.search(flat)
    if not date_match:
        raise BadRequestError("Could not find the event date in the PDF.")
    dd, mm, yyyy = (int(g) for g in date_match.groups())
    try:
        held_on = date(yyyy, mm, dd)
    except ValueError:
        raise BadRequestError(f"Invalid event date: {dd:02d}/{mm:02d}/{yyyy}.") from None

    rounds_match = _ROUNDS_RE.search(flat)
    if not rounds_match:
        raise BadRequestError("Could not determine the round count — is this a 'Standings by Rank' report?")
    rounds = int(rounds_match.group(1))
    if rounds != REQUIRED_ROUNDS:
        raise BadRequestError(
            f"Expected a {REQUIRED_ROUNDS}-round pod but this report has {rounds} rounds — wrong report format."
        )

    venue_match = _VENUE_RE.search(flat)
    venue = venue_match.group("venue").strip() if venue_match else None

    rows = _parse_rows(flat)
    if not rows:
        raise BadRequestError("No standings rows found in the PDF.")
    _validate_points(rows)
    return ParsedPdf(
        eventlink_id=eventlink_id,
        pod_number=pod_number,
        held_on=held_on,
        venue=venue,
        rounds=rounds,
        rows=rows,
    )


def _parse_rows(flat: str) -> list[ParsedRow]:
    # Rows sit between the dashed separator and the copyright footer.
    body = flat
    sep = re.search(r"-{5,}", body)
    if sep:
        body = body[sep.end() :]
    footer = body.find("EventLink - Copyright")
    if footer != -1:
        body = body[:footer]
    rows: list[ParsedRow] = []
    for m in _ROW_RE.finditer(body):
        rows.append(
            ParsedRow(rank=int(m.group("rank")), raw_name=m.group("name").strip(), points=int(m.group("points")))
        )
    return rows


def _validate_points(rows: list[ParsedRow]) -> None:
    for row in rows:
        if row.points not in POINTS_TO_WLD:
            raise BadRequestError(
                f"Player '{row.raw_name}' has {row.points} points, which is impossible in a "
                f"{REQUIRED_ROUNDS}-round pod — the PDF may be malformed."
            )


def compose_event_name(set_name: str | None, held_on: date, pod_number: int) -> str:
    """Build the ladder event name, e.g. 'Secrets of Strixhaven - 20 Jul 2026 - Pod 1'."""
    date_str = held_on.strftime("%d %b %Y")
    prefix = f"{set_name} - " if set_name else ""
    return f"{prefix}{date_str} - Pod {pod_number}"


# ---- Service ---------------------------------------------------------------------------


class PdfImporter:
    """Two-phase import of an EventLink standings PDF: preview (dry-run) then commit."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def preview(self, pdf_bytes: bytes) -> ImportPreview:
        parsed = parse_standings_pdf(pdf_bytes)
        existing_id = await self._existing_tournament_id(parsed.eventlink_id)
        season = await SeasonService(self._session).current_season(parsed.held_on)
        players = list((await self._session.execute(select(Player))).scalars().all())
        return ImportPreview(
            eventlink_id=parsed.eventlink_id,
            pod_number=parsed.pod_number,
            held_on=parsed.held_on,
            rounds=parsed.rounds,
            venue=parsed.venue,
            suggested_season_id=season.id if season else None,
            suggested_season_name=season.name if season else None,
            suggested_name=compose_event_name(season.name if season else None, parsed.held_on, parsed.pod_number),
            already_imported_tournament_id=existing_id,
            participants=[self._preview_participant(row, players) for row in parsed.rows],
        )

    async def commit(self, data: ImportCommitRequest) -> ImportCommitResult:
        existing_id = await self._existing_tournament_id(data.eventlink_id)
        if existing_id is not None:
            raise ConflictError(f"Already imported as tournament {existing_id}.")

        tournament = Tournament(
            held_on=data.held_on,
            season_id=data.season_id,
            name=data.name,
            notes=data.venue or None,
            eventlink_id=data.eventlink_id,
            has_match_detail=False,
        )
        self._session.add(tournament)
        await self._session.flush()

        players = list((await self._session.execute(select(Player))).scalars().all())
        created_ids: list[int] = []
        for entry in data.participants:
            player, created = await self._resolve_player(entry, players)
            if created:
                created_ids.append(player.id)
                players.append(player)
            self._session.add(
                TournamentParticipant(
                    tournament_id=tournament.id,
                    player_id=player.id,
                    match_wins=entry.wins,
                    match_losses=entry.losses,
                    match_draws=entry.draws,
                )
            )

        AuditRecorder(self._session).record(
            action="IMPORT",
            entity_type="tournament",
            entity_id=tournament.id,
            label=tournament.name or f"Tournament {tournament.held_on}",
            changes=[
                {"field": "eventlink_id", "old": None, "new": data.eventlink_id},
                {"field": "players", "old": None, "new": len(data.participants)},
                {"field": "created_players", "old": None, "new": len(created_ids)},
            ],
        )
        await self._session.commit()
        await self._session.refresh(tournament)
        return ImportCommitResult(
            tournament_id=tournament.id,
            name=tournament.name,
            participant_count=len(data.participants),
            created_player_ids=created_ids,
        )

    def _preview_participant(self, row: "ParsedRow", players: list[Player]) -> ImportPreviewParticipant:
        clean = tidy_name(row.raw_name)
        match = find_matching_player(players, clean)
        wins, losses, draws = wld_for_points(row.points)
        return ImportPreviewParticipant(
            raw_name=row.raw_name,
            normalized_name=clean,
            points=row.points,
            wins=wins,
            losses=losses,
            draws=draws,
            player_id=match.id if match else None,
            matched_name=match.display_name if match else None,
            will_create=match is None,
        )

    async def _resolve_player(self, entry: ImportCommitParticipant, players: list[Player]) -> tuple[Player, bool]:
        if entry.player_id is not None:
            player = await self._session.get(Player, entry.player_id)
            if player is None:
                raise BadRequestError(f"Player {entry.player_id} not found.")
            return player, False

        name = (entry.create_name or "").strip()
        # Guard against a duplicate that appeared since the preview was generated.
        match = find_matching_player(players, name)
        if match is not None:
            return match, False
        player = Player(display_name=name, aliases=[])
        self._session.add(player)
        await self._session.flush()
        return player, True

    async def _existing_tournament_id(self, eventlink_id: str) -> int | None:
        stmt = select(Tournament.id).where(Tournament.eventlink_id == eventlink_id)
        return (await self._session.execute(stmt)).scalars().first()
