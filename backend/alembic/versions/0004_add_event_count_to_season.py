"""add event_count to season

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-30
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("season") as batch_op:
        batch_op.add_column(
            sa.Column("event_count", sa.Integer(), nullable=False, server_default=sa.text("12"))
        )
    # Backfill event_count from actual tournament count per season
    op.execute(
        """
        UPDATE season
        SET event_count = (
            SELECT COUNT(*) FROM tournament WHERE tournament.season_id = season.id
        )
        WHERE (SELECT COUNT(*) FROM tournament WHERE tournament.season_id = season.id) > 0
        """
    )


def downgrade() -> None:
    with op.batch_alter_table("season") as batch_op:
        batch_op.drop_column("event_count")
