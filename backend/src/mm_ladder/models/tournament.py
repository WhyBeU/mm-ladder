from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class Tournament(Base, TimestampMixin):
    __tablename__ = "tournament"

    id: Mapped[int] = mapped_column(primary_key=True)
    held_on: Mapped[date] = mapped_column(Date, nullable=False)
    season_id: Mapped[int] = mapped_column(
        ForeignKey("season.id", name="fk_tournament_season"), nullable=False
    )
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    has_match_detail: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
