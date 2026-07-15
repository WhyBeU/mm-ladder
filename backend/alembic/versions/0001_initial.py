"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-26
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "player",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_player"),
    )
    op.create_table(
        "yearly_cup",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_yearly_cup"),
        sa.UniqueConstraint("year", name="uq_yearly_cup_year"),
    )
    op.create_table(
        "season",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("set_code", sa.String(length=10), nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=False),
        sa.Column("yearly_cup_id", sa.Integer(), nullable=True),
        sa.Column("qualifier_count", sa.Integer(), nullable=False, server_default=sa.text("2")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["yearly_cup_id"], ["yearly_cup.id"], name="fk_season_yearly_cup"),
        sa.PrimaryKeyConstraint("id", name="pk_season"),
        sa.UniqueConstraint("set_code", name="uq_season_set_code"),
    )
    op.create_table(
        "tournament",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("held_on", sa.Date(), nullable=False),
        sa.Column("season_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("has_match_detail", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["season_id"], ["season.id"], name="fk_tournament_season"),
        sa.PrimaryKeyConstraint("id", name="pk_tournament"),
    )
    op.create_table(
        "tournament_participant",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tournament_id", sa.Integer(), nullable=False),
        sa.Column("player_id", sa.Integer(), nullable=False),
        sa.Column("match_wins", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("match_losses", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("match_draws", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "points",
            sa.Integer(),
            sa.Computed("match_wins * 3 + match_draws", persisted=True),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["player_id"], ["player.id"], name="fk_tp_player"),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournament.id"], name="fk_tp_tournament"),
        sa.PrimaryKeyConstraint("id", name="pk_tournament_participant"),
        sa.UniqueConstraint("tournament_id", "player_id", name="uq_tp_tournament_player"),
    )
    op.create_table(
        "match",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tournament_id", sa.Integer(), nullable=False),
        sa.Column("player_a_id", sa.Integer(), nullable=False),
        sa.Column("player_b_id", sa.Integer(), nullable=False),
        sa.Column("games_a", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("games_b", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("game_draws", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("player_a_id != player_b_id", name="ck_match_different_players"),
        sa.ForeignKeyConstraint(["player_a_id"], ["player.id"], name="fk_match_player_a"),
        sa.ForeignKeyConstraint(["player_b_id"], ["player.id"], name="fk_match_player_b"),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournament.id"], name="fk_match_tournament"),
        sa.PrimaryKeyConstraint("id", name="pk_match"),
    )


def downgrade() -> None:
    op.drop_table("match")
    op.drop_table("tournament_participant")
    op.drop_table("tournament")
    op.drop_table("season")
    op.drop_table("yearly_cup")
    op.drop_table("player")
