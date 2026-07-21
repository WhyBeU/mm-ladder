from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .match import Match
    from .season import Season
    from .tournament_participant import TournamentParticipant


class Tournament(Base, TimestampMixin):
    __tablename__ = "tournament"
    __table_args__ = (UniqueConstraint("eventlink_id", name="uq_tournament_eventlink_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    held_on: Mapped[date] = mapped_column(Date, nullable=False)
    season_id: Mapped[int] = mapped_column(ForeignKey("season.id", name="fk_tournament_season"), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # EventLink event id, set when the tournament was imported from an EventLink PDF. Unique so a
    # given pod can't be imported twice; NULL for manually-created tournaments.
    eventlink_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    has_match_detail: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_migrated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    season: Mapped["Season"] = relationship("Season", back_populates="tournaments")
    participants: Mapped[list["TournamentParticipant"]] = relationship(
        "TournamentParticipant", back_populates="tournament", cascade="all, delete-orphan"
    )
    matches: Mapped[list["Match"]] = relationship("Match", back_populates="tournament", cascade="all, delete-orphan")
