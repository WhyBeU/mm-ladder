from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, utc_now

if TYPE_CHECKING:
    from .player import Player
    from .season import Season

# Status values for the singleton board.
BOARD_OPEN = "open"
BOARD_GENERATED = "generated"


class PodRegistration(Base):
    """Singleton state row for the public pod-registration board (always id=1)."""

    __tablename__ = "pod_registration"

    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[str] = mapped_column(String(16), default=BOARD_OPEN, nullable=False)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class PodFormat(Base):
    """A board format — the active season (ordinal 1) or one user-added second format."""

    __tablename__ = "pod_format"

    id: Mapped[int] = mapped_column(primary_key=True)
    ordinal: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    # null season ⇒ an "Other" format (Random seeding).
    season_id: Mapped[int | None] = mapped_column(ForeignKey("season.id", name="fk_pod_format_season"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    season: Mapped["Season | None"] = relationship("Season", lazy="selectin")


class PodPod(Base):
    """A generated pod (ordinal restarts per format)."""

    __tablename__ = "pod_pod"
    __table_args__ = (UniqueConstraint("format_id", "ordinal", name="uq_pod_pod_format_ordinal"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    format_id: Mapped[int | None] = mapped_column(ForeignKey("pod_format.id", name="fk_pod_pod_format"), nullable=True)
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class PodSignup(Base):
    """One person on the board — a claimed roster player or a typed-in extra."""

    __tablename__ = "pod_signup"

    id: Mapped[int] = mapped_column(primary_key=True)
    player_id: Mapped[int | None] = mapped_column(
        ForeignKey("player.id", name="fk_pod_signup_player"), nullable=True, unique=True
    )
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_extra: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    present: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    format_id: Mapped[int | None] = mapped_column(
        ForeignKey("pod_format.id", name="fk_pod_signup_format"), nullable=True
    )
    pod_id: Mapped[int | None] = mapped_column(ForeignKey("pod_pod.id", name="fk_pod_signup_pod"), nullable=True)
    seat: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    player: Mapped["Player | None"] = relationship("Player", lazy="selectin")


class PodEvent(Base):
    """A line in the board's activity feed; wiped on reset."""

    __tablename__ = "pod_event"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    message: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
