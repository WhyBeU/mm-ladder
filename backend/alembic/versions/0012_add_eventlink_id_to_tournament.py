"""add eventlink_id to tournament

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-21
"""

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("tournament") as batch_op:
        batch_op.add_column(sa.Column("eventlink_id", sa.String(length=32), nullable=True))
        batch_op.create_unique_constraint("uq_tournament_eventlink_id", ["eventlink_id"])


def downgrade() -> None:
    with op.batch_alter_table("tournament") as batch_op:
        batch_op.drop_constraint("uq_tournament_eventlink_id", type_="unique")
        batch_op.drop_column("eventlink_id")
