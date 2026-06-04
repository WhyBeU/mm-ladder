import json
import re
import time
from dataclasses import dataclass
from datetime import date, timedelta

import requests
from sqlalchemy import text
from sqlalchemy.orm import Session

from migration.seasons import SEASONS
from mm_ladder.logger import get_logger

log = get_logger("migration.verifier")

REQUEST_DELAY = 0.5
SITE_URL = "https://limitedspoiler.com/Team"

# (pts, nb_tournaments) per normalized player name
SiteTotals = dict[str, tuple[int, int]]


@dataclass
class SeasonSummary:
    set_code: str
    name: str
    db_players: int
    site_players: int
    db_pts: int
    site_pts: int
    db_events: int
    site_events: int
    mismatches: int


def _normalize(firstname: str, lastname: str) -> str:
    """Normalize to title-case with collapsed whitespace — mirrors importer._normalize_name."""
    first = " ".join(firstname.strip().split()).title()
    last = " ".join(lastname.strip().split()).title()
    return f"{first} {last}"


def fetch_site_totals(start: str, end: str) -> SiteTotals | None:
    """
    POST to limitedspoiler.com and return {normalized_name: (total_pts, nb_tournaments)}.
    Duplicate names (same person, multiple accounts) are merged: pts and events are summed.
    Returns None if the razor.players block is missing.
    """
    response = requests.post(
        SITE_URL,
        data={
            "leagueId": "8",
            "leagueName": "Magic Mates Monday",
            "StoreName": "Chromatic Games",
            "filterType": "Custom",
            "start": start,
            "end": end,
            "month": "January 2016",
            "seasonId": "45",
        },
        timeout=30,
    )
    match = re.search(r"razor\.players\s*=\s*(\[.*?\]);", response.text, re.DOTALL)
    if not match:
        return None
    players: list[dict] = json.loads(match.group(1))

    totals: SiteTotals = {}
    for p in players:
        name = _normalize(p["Firstname"], p["Lastname"])
        existing_pts, existing_nbt = totals.get(name, (0, 0))
        totals[name] = (
            existing_pts + p["TotalMatchPoints"],
            max(existing_nbt, p["NbTournaments"]),
        )
    return totals


def verify_season(session: Session, set_code: str, name: str) -> tuple[int, SeasonSummary | None]:
    """
    Verify one season against limitedspoiler.com using a single full-season range query.
    Compares both total points and number of events per player.
    Returns (mismatches, SeasonSummary).
    """
    log.info("verifying season", set_code=set_code, name=name)

    season_meta = next((s for s in SEASONS if s["set_code"] == set_code), None)
    if season_meta is None:
        log.warning("season not found in SEASONS, skipping", set_code=set_code)
        return 1, None

    starts_on = date.fromisoformat(season_meta["starts_on"])
    ends_on = date.fromisoformat(season_meta["ends_on"])
    log.debug("fetching site data for season", set_code=set_code)

    site_totals = fetch_site_totals(
        starts_on.strftime("%d/%m/%Y"),
        (ends_on + timedelta(days=2)).strftime("%d/%m/%Y"),
    )
    if site_totals is None:
        log.error("could not parse season data from site", set_code=set_code)
        return 1, None

    rows = session.execute(
        text(
            """
            SELECT p.display_name,
                   SUM(tp.points)        AS season_pts,
                   COUNT(DISTINCT t.id)  AS season_events
            FROM player p
            JOIN tournament_participant tp ON tp.player_id = p.id
            JOIN tournament t             ON tp.tournament_id = t.id
            JOIN season s                 ON t.season_id = s.id
            WHERE s.set_code = :set_code AND t.is_migrated = 1
            GROUP BY p.id
        """
        ),
        {"set_code": set_code},
    ).fetchall()
    db_totals: dict[str, tuple[int, int]] = {r[0]: (r[1], r[2]) for r in rows}

    mismatches: list[tuple[str, tuple[int, int], tuple[int, int]]] = []
    for player, (site_pts, site_nbt) in site_totals.items():
        db_pts, db_nbt = db_totals.get(player, (0, 0))
        if db_pts != site_pts or db_nbt != site_nbt:
            mismatches.append((player, (db_pts, db_nbt), (site_pts, site_nbt)))

    site_count = len(site_totals)
    db_count = len(db_totals)
    mismatch_count = len(mismatches) + (1 if site_count != db_count else 0)

    if mismatches or site_count != db_count:
        for player, (db_pts, db_ev), (site_pts, site_ev) in mismatches:
            log.warning(
                "mismatch",
                set_code=set_code,
                player=player,
                db_pts=db_pts,
                site_pts=site_pts,
                pts_diff=site_pts - db_pts,
                db_events=db_ev,
                site_events=site_ev,
                events_diff=site_ev - db_ev,
            )
        if site_count != db_count:
            log.warning(
                "player count mismatch",
                set_code=set_code,
                db_players=db_count,
                site_players=site_count,
            )
        log.error("season verification failed", set_code=set_code, mismatches=mismatch_count)
    else:
        log.info("season verified", set_code=set_code, players=db_count)

    summary = SeasonSummary(
        set_code=set_code,
        name=name,
        db_players=db_count,
        site_players=site_count,
        db_pts=sum(pts for pts, _ in db_totals.values()),
        site_pts=sum(pts for pts, _ in site_totals.values()),
        db_events=sum(ev for _, ev in db_totals.values()),
        site_events=sum(ev for _, ev in site_totals.values()),
        mismatches=mismatch_count,
    )
    return mismatch_count, summary


def _print_season_table(summaries: list[SeasonSummary]) -> None:
    if not summaries:
        return
    name_w = max(len(s.name) for s in summaries)
    hdr = (
        f"  {'Set':<6}  {'Season':<{name_w}}"
        f"  {'DB Plyr':>7}  {'Site Plyr':>9}"
        f"  {'DB Pts':>7}  {'Site Pts':>8}"
        f"  {'DB Ev':>6}  {'Site Ev':>7}"
        f"  {'Status'}"
    )
    sep = "  " + "-" * (len(hdr) - 2)
    print()
    print("=== Season Verification Summary ===")
    print(hdr)
    print(sep)
    for s in summaries:
        ok = "✓" if s.mismatches == 0 else f"✗ ({s.mismatches})"
        print(
            f"  {s.set_code:<6}  {s.name:<{name_w}}"
            f"  {s.db_players:>7}  {s.site_players:>9}"
            f"  {s.db_pts:>7}  {s.site_pts:>8}"
            f"  {s.db_events:>6}  {s.site_events:>7}"
            f"  {ok}"
        )
    print(sep)
    print(
        f"  {'TOTAL':<6}  {'':<{name_w}}"
        f"  {sum(s.db_players for s in summaries):>7}  {sum(s.site_players for s in summaries):>9}"
        f"  {sum(s.db_pts for s in summaries):>7}  {sum(s.site_pts for s in summaries):>8}"
        f"  {sum(s.db_events for s in summaries):>6}  {sum(s.site_events for s in summaries):>7}"
    )


def _print_player_table(db_all: dict[str, tuple[int, int]], site_all: SiteTotals) -> None:
    all_names = sorted(site_all.keys() | db_all.keys(), key=lambda n: -site_all.get(n, (0, 0))[0])
    name_w = max((len(n) for n in all_names), default=10)
    hdr = (
        f"  {'Player':<{name_w}}"
        f"  {'DB Pts':>7}  {'Site Pts':>8}  {'Pts Diff':>8}"
        f"  {'DB Ev':>6}  {'Site Ev':>7}  {'Ev Diff':>7}"
        f"  Status"
    )
    sep = "  " + "-" * (len(hdr) - 2)
    print()
    print("=== All-Time Player Totals ===")
    print(hdr)
    print(sep)
    for name in all_names:
        db_pts, db_ev = db_all.get(name, (0, 0))
        site_pts, site_ev = site_all.get(name, (0, 0))
        pts_diff = site_pts - db_pts
        ev_diff = site_ev - db_ev
        ok = "✓" if pts_diff == 0 and ev_diff == 0 else f"{'±'}{abs(pts_diff)}pts {'±'}{abs(ev_diff)}ev"
        print(
            f"  {name:<{name_w}}"
            f"  {db_pts:>7}  {site_pts:>8}  {pts_diff:>+8}"
            f"  {db_ev:>6}  {site_ev:>7}  {ev_diff:>+7}"
            f"  {ok}"
        )
    print(sep)
    print(
        f"  {'TOTAL':<{name_w}}"
        f"  {sum(pts for pts, _ in db_all.values()):>7}"
        f"  {sum(pts for pts, _ in site_all.values()):>8}"
        f"  {'':>8}"
        f"  {sum(ev for _, ev in db_all.values()):>6}"
        f"  {sum(ev for _, ev in site_all.values()):>7}"
    )


def run_verify(session: Session, set_code: str | None = None) -> tuple[int, int]:
    """
    Verify all migrated seasons (or just one if set_code given) and all-time totals.
    Returns (seasons_checked, total_mismatches). total_mismatches=-1 means all-time parse failure.
    """
    query = """
        SELECT DISTINCT s.set_code, s.name
        FROM season s
        JOIN tournament t ON t.season_id = s.id
        WHERE t.is_migrated = 1
    """
    params: dict = {}
    if set_code is not None:
        query += " AND s.set_code = :set_code"
        params["set_code"] = set_code
    query += " ORDER BY s.starts_on"

    migrated_seasons = session.execute(text(query), params).fetchall()

    log.info("verifying seasons", count=len(migrated_seasons))
    total_mismatches = 0
    season_summaries: list[SeasonSummary] = []

    for row in migrated_seasons:
        sc, name = row
        mismatches, summary = verify_season(session, sc, name)
        total_mismatches += mismatches
        if summary is not None:
            season_summaries.append(summary)
        time.sleep(REQUEST_DELAY)

    _print_season_table(season_summaries)

    log.info("fetching all-time totals from site")
    site_all = fetch_site_totals("01/01/2016", "31/12/2030")
    if site_all is None:
        log.error("could not parse all-time data from site")
        return len(migrated_seasons), -1

    rows = session.execute(
        text(
            """
            SELECT p.display_name,
                   SUM(tp.points)       AS total_pts,
                   COUNT(DISTINCT t.id) AS total_events
            FROM player p
            JOIN tournament_participant tp ON tp.player_id = p.id
            JOIN tournament t             ON tp.tournament_id = t.id
            GROUP BY p.id
        """
        )
    ).fetchall()
    db_all: dict[str, tuple[int, int]] = {r[0]: (r[1], r[2]) for r in rows}

    # When verifying a specific season, restrict both tables to players in that season
    if set_code is not None:
        season_players = {
            r[0]
            for r in session.execute(
                text(
                    """
                    SELECT DISTINCT p.display_name
                    FROM player p
                    JOIN tournament_participant tp ON tp.player_id = p.id
                    JOIN tournament t             ON tp.tournament_id = t.id
                    JOIN season s                 ON t.season_id = s.id
                    WHERE s.set_code = :set_code AND t.is_migrated = 1
                """
                ),
                {"set_code": set_code},
            ).fetchall()
        }
        db_all = {k: v for k, v in db_all.items() if k in season_players}
        site_all = {k: v for k, v in site_all.items() if k in season_players}

    log.info("comparing all-time totals", site_players=len(site_all), db_players=len(db_all))
    alltime_mismatches = [
        (name, db_all.get(name, (0, 0)), site_val)
        for name, site_val in site_all.items()
        if db_all.get(name, (0, 0)) != site_val
    ]
    if alltime_mismatches:
        for name, (db_pts, db_ev), (site_pts, site_ev) in alltime_mismatches:
            log.warning(
                "all-time mismatch",
                player=name,
                db_pts=db_pts,
                site_pts=site_pts,
                pts_diff=site_pts - db_pts,
                db_events=db_ev,
                site_events=site_ev,
                events_diff=site_ev - db_ev,
            )
        total_mismatches += len(alltime_mismatches)

    _print_player_table(db_all, site_all)

    return len(migrated_seasons), total_mismatches
