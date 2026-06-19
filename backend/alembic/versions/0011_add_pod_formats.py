"""add pod formats

Revision ID: 0011
Revises: 0010
Create Date: 2026-06-19
"""

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pod_format",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("season_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["season_id"], ["season.id"], name="fk_pod_format_season"),
        sa.PrimaryKeyConstraint("id", name="pk_pod_format"),
        sa.UniqueConstraint("ordinal", name="uq_pod_format_ordinal"),
    )

    with op.batch_alter_table("pod_signup", recreate="always") as batch:
        batch.add_column(sa.Column("format_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_pod_signup_format", "pod_format", ["format_id"], ["id"])

    with op.batch_alter_table("pod_pod", recreate="always") as batch:
        batch.add_column(sa.Column("format_id", sa.Integer(), nullable=True))
        batch.drop_constraint("uq_pod_pod_ordinal", type_="unique")
        batch.create_unique_constraint("uq_pod_pod_format_ordinal", ["format_id", "ordinal"])
        batch.create_foreign_key("fk_pod_pod_format", "pod_format", ["format_id"], ["id"])


def downgrade() -> None:
    with op.batch_alter_table("pod_pod", recreate="always") as batch:
        batch.drop_constraint("fk_pod_pod_format", type_="foreignkey")
        batch.drop_constraint("uq_pod_pod_format_ordinal", type_="unique")
        batch.create_unique_constraint("uq_pod_pod_ordinal", ["ordinal"])
        batch.drop_column("format_id")

    with op.batch_alter_table("pod_signup", recreate="always") as batch:
        batch.drop_constraint("fk_pod_signup_format", type_="foreignkey")
        batch.drop_column("format_id")

    op.drop_table("pod_format")
