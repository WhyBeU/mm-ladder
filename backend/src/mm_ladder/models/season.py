from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .tournament import Tournament
    from .yearly_cup import YearlyCup


class Season(Base, TimestampMixin):
    __tablename__ = "season"
    __table_args__ = (UniqueConstraint("set_code", name="uq_season_set_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    set_code: Mapped[str] = mapped_column(String(10), nullable=False)
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date] = mapped_column(Date, nullable=False)
    yearly_cup_id: Mapped[int | None] = mapped_column(
        ForeignKey("yearly_cup.id", name="fk_season_yearly_cup"), nullable=True
    )
    qualifier_count: Mapped[int] = mapped_column(Integer, default=2, nullable=False)

    yearly_cup: Mapped["YearlyCup | None"] = relationship("YearlyCup", back_populates="seasons")
    tournaments: Mapped[list["Tournament"]] = relationship("Tournament", back_populates="season")
