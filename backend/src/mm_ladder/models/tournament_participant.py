from sqlalchemy import Computed, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin
from .player import Player
from .tournament import Tournament


class TournamentParticipant(Base, TimestampMixin):
    __tablename__ = "tournament_participant"
    __table_args__ = (UniqueConstraint("tournament_id", "player_id", name="uq_tp_tournament_player"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournament.id", name="fk_tp_tournament"), nullable=False)
    player_id: Mapped[int] = mapped_column(ForeignKey("player.id", name="fk_tp_player"), nullable=False)
    match_wins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    match_losses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    match_draws: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    points: Mapped[int] = mapped_column(Computed("match_wins * 3 + match_draws", persisted=True), nullable=False)

    tournament: Mapped[Tournament] = relationship(Tournament, back_populates="participants")
    player: Mapped[Player] = relationship(Player, back_populates="participations")
