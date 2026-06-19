from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from mm_ladder.errors import BadRequestError, ConflictError, NotFoundError
from mm_ladder.interface.board import FormatCreateRequest, GenerateRequest, SignupCreateRequest
from mm_ladder.models.base import utc_now
from mm_ladder.models.board import (
    BOARD_GENERATED,
    BOARD_OPEN,
    PodEvent,
    PodFormat,
    PodPod,
    PodRegistration,
    PodSignup,
)
from mm_ladder.models.player import Player
from mm_ladder.models.season import Season
from mm_ladder.services.season import SeasonService

# A generated board left untouched for this long is wiped on the next read.
AUTO_CLEAR_AFTER = timedelta(days=3)
# Fallback name for format 1 when the system has no seasons yet.
DEFAULT_FORMAT_NAME = "Draft"


@dataclass
class BoardData:
    state: PodRegistration
    formats: list[PodFormat]
    signups: list[PodSignup]
    pods: list[PodPod]
    events: list[PodEvent]


class BoardService:
    def __init__(self, session: AsyncSession, now: Callable[[], datetime] = utc_now) -> None:
        self._session = session
        self._now = now

    # ── state / format helpers ────────────────────────────────────────────────

    async def _get_or_create_state(self) -> PodRegistration:
        state = await self._session.get(PodRegistration, 1)
        if state is None:
            state = PodRegistration(id=1, status=BOARD_OPEN, last_activity_at=self._now())
            self._session.add(state)
            await self._session.flush()
        await self._ensure_default_format()
        return state

    async def _formats(self) -> list[PodFormat]:
        result = await self._session.execute(select(PodFormat).order_by(PodFormat.ordinal))
        return list(result.scalars().all())

    async def _format_by_ordinal(self, ordinal: int) -> PodFormat | None:
        result = await self._session.execute(select(PodFormat).where(PodFormat.ordinal == ordinal))
        return result.scalar_one_or_none()

    async def _ensure_default_format(self) -> PodFormat:
        existing = await self._format_by_ordinal(1)
        if existing is not None:
            return existing
        season = await SeasonService(self._session).current_season()
        fmt = PodFormat(
            ordinal=1,
            name=season.set_code if season else DEFAULT_FORMAT_NAME,
            season_id=season.id if season else None,
        )
        self._session.add(fmt)
        await self._session.flush()
        return fmt

    def _log(self, state: PodRegistration, kind: str, message: str) -> None:
        self._session.add(PodEvent(kind=kind, message=message))
        state.last_activity_at = self._now()

    async def _signups(self) -> list[PodSignup]:
        result = await self._session.execute(select(PodSignup).order_by(PodSignup.id))
        return list(result.scalars().all())

    async def _pods(self) -> list[PodPod]:
        result = await self._session.execute(select(PodPod).order_by(PodPod.format_id, PodPod.ordinal))
        return list(result.scalars().all())

    async def _events(self) -> list[PodEvent]:
        result = await self._session.execute(select(PodEvent).order_by(PodEvent.id.desc()))
        return list(result.scalars().all())

    async def _data(self, state: PodRegistration) -> BoardData:
        return BoardData(
            state=state,
            formats=await self._formats(),
            signups=await self._signups(),
            pods=await self._pods(),
            events=await self._events(),
        )

    async def _wipe(self, state: PodRegistration) -> None:
        await self._session.execute(delete(PodSignup))
        await self._session.execute(delete(PodPod))
        await self._session.execute(delete(PodEvent))
        await self._session.execute(delete(PodFormat))
        state.status = BOARD_OPEN
        state.generated_at = None
        state.last_activity_at = self._now()
        await self._session.flush()
        await self._ensure_default_format()

    # ── reads ────────────────────────────────────────────────────────────────

    async def get_board(self) -> BoardData:
        state = await self._get_or_create_state()
        # SQLite returns naive datetimes for timezone-aware columns; assume UTC.
        last = state.last_activity_at
        if last.tzinfo is None:
            last = last.replace(tzinfo=UTC)
        if state.status == BOARD_GENERATED and self._now() - last > AUTO_CLEAR_AFTER:
            await self._wipe(state)
            await self._session.commit()
        return await self._data(state)

    # ── formats ──────────────────────────────────────────────────────────────

    async def add_format(self, data: FormatCreateRequest) -> PodFormat:
        state = await self._get_or_create_state()
        if len(await self._formats()) >= 2:
            raise ConflictError("The board already has two formats")

        if data.season_id is not None:
            season = await self._session.get(Season, data.season_id)
            if season is None:
                raise NotFoundError("Season", data.season_id)
            name = (data.name or season.set_code).strip()
            season_id: int | None = season.id
        elif data.name and data.name.strip():
            name = data.name.strip()
            season_id = None
        else:
            raise BadRequestError("A format needs a season_id or a name")

        fmt = PodFormat(ordinal=2, name=name, season_id=season_id)
        self._session.add(fmt)
        await self._session.flush()
        self._log(state, "format_added", f"{name} added")
        await self._session.commit()
        await self._session.refresh(fmt)
        return fmt

    async def remove_format(self, format_id: int) -> None:
        state = await self._get_or_create_state()
        fmt = await self._session.get(PodFormat, format_id)
        if fmt is None:
            raise NotFoundError("PodFormat", format_id)
        if fmt.ordinal == 1:
            raise BadRequestError("The default format can't be removed")

        default = await self._ensure_default_format()
        for signup in await self._signups():
            if signup.format_id == fmt.id:
                signup.format_id = default.id
                signup.pod_id = None
                signup.seat = None
        await self._session.execute(delete(PodPod).where(PodPod.format_id == fmt.id))
        name = fmt.name
        await self._session.delete(fmt)
        self._log(state, "format_removed", f"{name} removed")
        await self._session.commit()

    # ── signups ────────────────────────────────────────────────────────────

    async def add_signup(self, data: SignupCreateRequest) -> PodSignup:
        state = await self._get_or_create_state()
        default = await self._ensure_default_format()
        if data.player_id is not None:
            player = await self._session.get(Player, data.player_id)
            if player is None:
                raise NotFoundError("Player", data.player_id)
            existing = await self._session.execute(select(PodSignup).where(PodSignup.player_id == data.player_id))
            if existing.scalar_one_or_none() is not None:
                raise ConflictError(f"{player.display_name} is already signed up")
            signup = PodSignup(player_id=player.id, display_name=player.display_name, is_extra=False)
            message = f"{player.display_name} signed up"
        elif data.display_name and data.display_name.strip():
            name = data.display_name.strip()
            signup = PodSignup(player_id=None, display_name=name, is_extra=True)
            message = f"{name} signed up (extra)"
        else:
            raise BadRequestError("A signup needs a player_id or a display_name")

        signup.format_id = default.id
        self._session.add(signup)
        await self._session.flush()
        self._log(state, "signup_added", message)
        await self._session.commit()
        await self._session.refresh(signup)
        return signup

    async def remove_signup(self, signup_id: int) -> None:
        state = await self._get_or_create_state()
        signup = await self._session.get(PodSignup, signup_id)
        if signup is None:
            raise NotFoundError("PodSignup", signup_id)
        name = signup.display_name
        await self._session.delete(signup)
        self._log(state, "signup_removed", f"{name} removed")
        await self._session.commit()

    async def set_present(self, signup_id: int, present: bool) -> PodSignup:
        state = await self._get_or_create_state()
        signup = await self._session.get(PodSignup, signup_id)
        if signup is None:
            raise NotFoundError("PodSignup", signup_id)
        signup.present = present
        verb = "present" if present else "not present"
        self._log(state, "present_toggled", f"{signup.display_name} marked {verb}")
        await self._session.commit()
        await self._session.refresh(signup)
        return signup

    async def move_signup(self, signup_id: int, format_id: int) -> PodSignup:
        state = await self._get_or_create_state()
        signup = await self._session.get(PodSignup, signup_id)
        if signup is None:
            raise NotFoundError("PodSignup", signup_id)
        fmt = await self._session.get(PodFormat, format_id)
        if fmt is None:
            raise BadRequestError(f"Unknown format {format_id}")
        signup.format_id = fmt.id
        signup.pod_id = None
        signup.seat = None
        self._log(state, "signup_moved", f"{signup.display_name} moved to {fmt.name}")
        await self._session.commit()
        await self._session.refresh(signup)
        return signup

    async def present_all(self) -> None:
        state = await self._get_or_create_state()
        for signup in await self._signups():
            signup.present = True
        self._log(state, "present_all", "Everyone marked present")
        await self._session.commit()

    # ── generate / pods ──────────────────────────────────────────────────────

    async def generate(self, data: GenerateRequest) -> None:
        state = await self._get_or_create_state()
        signups = {s.id: s for s in await self._signups()}
        formats = {f.id: f for f in await self._formats()}

        for group in data.formats:
            if group.format_id not in formats:
                raise BadRequestError(f"Unknown format {group.format_id}")
            for pod in group.pods:
                for signup_id in pod:
                    signup = signups.get(signup_id)
                    if signup is None:
                        raise BadRequestError(f"Unknown signup {signup_id}")
                    if not signup.present:
                        raise BadRequestError(f"{signup.display_name} is not present")
                    if signup.format_id != group.format_id:
                        raise BadRequestError(f"{signup.display_name} is not in that format")

        # Clear any prior assignment, then delete the old pods.
        for signup in signups.values():
            signup.pod_id = None
            signup.seat = None
        await self._session.flush()
        await self._session.execute(delete(PodPod))

        summary_parts: list[str] = []
        for group in data.formats:
            for ordinal, pod in enumerate(group.pods, start=1):
                pod_row = PodPod(format_id=group.format_id, ordinal=ordinal)
                self._session.add(pod_row)
                await self._session.flush()
                for seat, signup_id in enumerate(pod, start=1):
                    signups[signup_id].pod_id = pod_row.id
                    signups[signup_id].seat = seat
            count = len(group.pods)
            if count:
                label = f" ({group.seeding_label})" if group.seeding_label else ""
                summary_parts.append(f"{formats[group.format_id].name}{label} {count} pod{'' if count == 1 else 's'}")

        state.status = BOARD_GENERATED
        state.generated_at = self._now()
        summary = " · ".join(summary_parts) if summary_parts else "no pods"
        self._log(state, "pods_generated", f"Pods generated · {summary}")
        await self._session.commit()

    async def set_pod_code(self, pod_id: int, code: str) -> PodPod:
        state = await self._get_or_create_state()
        pod = await self._session.get(PodPod, pod_id)
        if pod is None:
            raise NotFoundError("PodPod", pod_id)
        pod.code = code
        fmt = await self._session.get(PodFormat, pod.format_id) if pod.format_id is not None else None
        label = f"{fmt.name} pod {pod.ordinal}" if fmt else f"Pod {pod.ordinal}"
        self._log(state, "pod_code_set", f"{label} code set")
        await self._session.commit()
        await self._session.refresh(pod)
        return pod

    async def reset(self) -> None:
        state = await self._get_or_create_state()
        await self._wipe(state)
        await self._session.commit()
