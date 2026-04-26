from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, utc_now
from .player import Player
from .tournament import Tournament

if TYPE_CHECKING:
    pass


class Match(Base):
    __tablename__ = "match"
    __table_args__ = (
        CheckConstraint("player_a_id != player_b_id", name="ck_match_different_players"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tournament_id: Mapped[int] = mapped_column(
        ForeignKey("tournament.id", name="fk_match_tournament"), nullable=False
    )
    player_a_id: Mapped[int] = mapped_column(
        ForeignKey("player.id", name="fk_match_player_a"), nullable=False
    )
    player_b_id: Mapped[int] = mapped_column(
        ForeignKey("player.id", name="fk_match_player_b"), nullable=False
    )
    games_a: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    games_b: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    game_draws: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    tournament: Mapped[Tournament] = relationship(Tournament, back_populates="matches")
    player_a: Mapped[Player] = relationship(
        Player, foreign_keys=[player_a_id], back_populates="matches_as_a"
    )
    player_b: Mapped[Player] = relationship(
        Player, foreign_keys=[player_b_id], back_populates="matches_as_b"
    )
