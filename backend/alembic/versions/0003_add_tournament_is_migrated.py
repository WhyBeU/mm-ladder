"""add is_migrated to tournament

Revision ID: 0003
Revises: 0001
Create Date: 2026-05-19
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("tournament") as batch_op:
        batch_op.add_column(
            sa.Column("is_migrated", sa.Boolean(), nullable=False, server_default=sa.false())
        )


def downgrade() -> None:
    with op.batch_alter_table("tournament") as batch_op:
        batch_op.drop_column("is_migrated")
