from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Column, Date, ForeignKey, Integer, String, Table, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .player import Player
    from .season import Season


yearly_cup_qualification = Table(
    "yearly_cup_qualification",
    Base.metadata,
    Column("yearly_cup_id", Integer, ForeignKey("yearly_cup.id", name="fk_yc_qualification_cup"), primary_key=True),
    Column("player_id", Integer, ForeignKey("player.id", name="fk_yc_qualification_player"), primary_key=True),
)


class YearlyCup(Base, TimestampMixin):
    __tablename__ = "yearly_cup"
    __table_args__ = (UniqueConstraint("year", name="uq_yearly_cup_year"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date] = mapped_column(Date, nullable=False)
    player_of_the_year_id: Mapped[int | None] = mapped_column(
        ForeignKey("player.id", name="fk_yearly_cup_poty_player"), nullable=True
    )
    cup_winner_id: Mapped[int | None] = mapped_column(
        ForeignKey("player.id", name="fk_yearly_cup_winner_player"), nullable=True
    )

    seasons: Mapped[list["Season"]] = relationship("Season", back_populates="yearly_cup")
    player_of_the_year: Mapped["Player | None"] = relationship(
        "Player", foreign_keys=[player_of_the_year_id], back_populates="poty_cups", lazy="selectin"
    )
    cup_winner: Mapped["Player | None"] = relationship(
        "Player", foreign_keys=[cup_winner_id], back_populates="cup_championships", lazy="selectin"
    )
    qualified_players: Mapped[list["Player"]] = relationship(
        "Player", secondary=yearly_cup_qualification, lazy="selectin"
    )

    @property
    def player_of_the_year_name(self) -> str | None:
        return self.player_of_the_year.display_name if self.player_of_the_year else None

    @property
    def cup_winner_name(self) -> str | None:
        return self.cup_winner.display_name if self.cup_winner else None

    @property
    def qualified_player_ids(self) -> list[int]:
        return [p.id for p in self.qualified_players]
