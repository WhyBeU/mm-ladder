from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .match import Match
    from .tournament_participant import TournamentParticipant


class Player(Base, TimestampMixin):
    __tablename__ = "player"

    id: Mapped[int] = mapped_column(primary_key=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    aliases: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    participations: Mapped[list["TournamentParticipant"]] = relationship(
        "TournamentParticipant", back_populates="player"
    )
    matches_as_a: Mapped[list["Match"]] = relationship(
        "Match", foreign_keys="[Match.player_a_id]", back_populates="player_a"
    )
    matches_as_b: Mapped[list["Match"]] = relationship(
        "Match", foreign_keys="[Match.player_b_id]", back_populates="player_b"
    )
