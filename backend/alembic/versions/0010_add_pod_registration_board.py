"""add pod-registration board

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-19
"""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pod_registration",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_pod_registration"),
    )
    op.create_table(
        "pod_pod",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_pod_pod"),
        sa.UniqueConstraint("ordinal", name="uq_pod_pod_ordinal"),
    )
    op.create_table(
        "pod_signup",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("player_id", sa.Integer(), nullable=True),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("is_extra", sa.Boolean(), nullable=False),
        sa.Column("present", sa.Boolean(), nullable=False),
        sa.Column("pod_id", sa.Integer(), nullable=True),
        sa.Column("seat", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["player_id"], ["player.id"], name="fk_pod_signup_player"),
        sa.ForeignKeyConstraint(["pod_id"], ["pod_pod.id"], name="fk_pod_signup_pod"),
        sa.PrimaryKeyConstraint("id", name="pk_pod_signup"),
        sa.UniqueConstraint("player_id", name="uq_pod_signup_player"),
    )
    op.create_table(
        "pod_event",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("message", sa.String(length=512), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_pod_event"),
    )


def downgrade() -> None:
    op.drop_table("pod_event")
    op.drop_table("pod_signup")
    op.drop_table("pod_pod")
    op.drop_table("pod_registration")
