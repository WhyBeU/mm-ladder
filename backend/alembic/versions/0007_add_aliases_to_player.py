"""add aliases to player

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-08
"""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("player") as batch_op:
        batch_op.add_column(
            sa.Column("aliases", sa.JSON(), nullable=False, server_default=sa.text("'[]'"))
        )


def downgrade() -> None:
    with op.batch_alter_table("player") as batch_op:
        batch_op.drop_column("aliases")
