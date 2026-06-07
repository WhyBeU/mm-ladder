"""add qualifying_type to season

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-07
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("season") as batch_op:
        batch_op.add_column(
            sa.Column(
                "qualifying_type",
                sa.String(10),
                nullable=False,
                server_default=sa.text("'POINTS'"),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("season") as batch_op:
        batch_op.drop_column("qualifying_type")
