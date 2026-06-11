"""add champions and cup qualification

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-11
"""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("season") as batch_op:
        batch_op.add_column(sa.Column("champion_player_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key("fk_season_champion_player", "player", ["champion_player_id"], ["id"])

    with op.batch_alter_table("yearly_cup") as batch_op:
        batch_op.add_column(sa.Column("player_of_the_year_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("cup_winner_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key("fk_yearly_cup_poty_player", "player", ["player_of_the_year_id"], ["id"])
        batch_op.create_foreign_key("fk_yearly_cup_winner_player", "player", ["cup_winner_id"], ["id"])

    op.create_table(
        "yearly_cup_qualification",
        sa.Column("yearly_cup_id", sa.Integer(), nullable=False),
        sa.Column("player_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["yearly_cup_id"], ["yearly_cup.id"], name="fk_yc_qualification_cup"),
        sa.ForeignKeyConstraint(["player_id"], ["player.id"], name="fk_yc_qualification_player"),
        sa.PrimaryKeyConstraint("yearly_cup_id", "player_id", name="pk_yearly_cup_qualification"),
    )


def downgrade() -> None:
    op.drop_table("yearly_cup_qualification")

    with op.batch_alter_table("yearly_cup") as batch_op:
        batch_op.drop_constraint("fk_yearly_cup_winner_player", type_="foreignkey")
        batch_op.drop_constraint("fk_yearly_cup_poty_player", type_="foreignkey")
        batch_op.drop_column("cup_winner_id")
        batch_op.drop_column("player_of_the_year_id")

    with op.batch_alter_table("season") as batch_op:
        batch_op.drop_constraint("fk_season_champion_player", type_="foreignkey")
        batch_op.drop_column("champion_player_id")
