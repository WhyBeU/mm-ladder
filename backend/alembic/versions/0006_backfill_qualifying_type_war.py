"""backfill qualifying_type to BEST for qualifying seasons from War of the Spark onward

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-07
"""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

# War of the Spark (set_code "war") starts on 2019-04-27 — the cup switched from
# total-points qualification to "best N event scores" qualification from here on.
BEST_QUALIFYING_FROM = "2019-04-27"


def upgrade() -> None:
    season = sa.table(
        "season",
        sa.column("starts_on", sa.Date),
        sa.column("qualifier_count", sa.Integer),
        sa.column("qualifying_type", sa.String),
    )
    op.execute(
        season.update()
        .where(season.c.starts_on >= BEST_QUALIFYING_FROM)
        .where(season.c.qualifier_count > 0)
        .values(qualifying_type="BEST")
    )


def downgrade() -> None:
    season = sa.table(
        "season",
        sa.column("starts_on", sa.Date),
        sa.column("qualifying_type", sa.String),
    )
    op.execute(
        season.update()
        .where(season.c.starts_on >= BEST_QUALIFYING_FROM)
        .values(qualifying_type="POINTS")
    )
