from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .season import Season


class YearlyCup(Base, TimestampMixin):
    __tablename__ = "yearly_cup"
    __table_args__ = (UniqueConstraint("year", name="uq_yearly_cup_year"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date] = mapped_column(Date, nullable=False)

    seasons: Mapped[list["Season"]] = relationship("Season", back_populates="yearly_cup")
