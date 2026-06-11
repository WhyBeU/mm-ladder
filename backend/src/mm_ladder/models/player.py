from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .match import Match
    from .season import Season
    from .tournament_participant import TournamentParticipant
    from .yearly_cup import YearlyCup


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
    season_championships: Mapped[list["Season"]] = relationship(
        "Season", foreign_keys="[Season.champion_player_id]", back_populates="champion", lazy="selectin"
    )
    poty_cups: Mapped[list["YearlyCup"]] = relationship(
        "YearlyCup",
        foreign_keys="[YearlyCup.player_of_the_year_id]",
        back_populates="player_of_the_year",
        lazy="selectin",
    )
    cup_championships: Mapped[list["YearlyCup"]] = relationship(
        "YearlyCup", foreign_keys="[YearlyCup.cup_winner_id]", back_populates="cup_winner", lazy="selectin"
    )

    @property
    def season_champion_set_codes(self) -> list[str]:
        return [s.set_code for s in self.season_championships]

    @property
    def player_of_the_year_cup_names(self) -> list[str]:
        return [c.name for c in self.poty_cups]

    @property
    def cup_champion_cup_names(self) -> list[str]:
        return [c.name for c in self.cup_championships]
