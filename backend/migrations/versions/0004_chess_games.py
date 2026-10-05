"""chess games

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-05 12:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('chess_games',
    sa.Column('uuid', sa.String(length=40), nullable=False),
    sa.Column('url', sa.String(length=200), nullable=False),
    sa.Column('ended_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('time_class', sa.String(length=20), nullable=False),
    sa.Column('time_control', sa.String(length=20), nullable=False),
    sa.Column('rated', sa.Boolean(), nullable=False),
    sa.Column('color', sa.String(length=5), nullable=False),
    sa.Column('rating', sa.Integer(), nullable=False),
    sa.Column('opponent', sa.String(length=60), nullable=False),
    sa.Column('opponent_rating', sa.Integer(), nullable=True),
    sa.Column('result', sa.String(length=30), nullable=False),
    sa.Column('opponent_result', sa.String(length=30), nullable=False),
    sa.Column('outcome', sa.String(length=5), nullable=False),
    sa.Column('abandoned', sa.Boolean(), nullable=False),
    sa.Column('opening', sa.String(length=100), nullable=True),
    sa.Column('eco', sa.String(length=10), nullable=True),
    sa.PrimaryKeyConstraint('uuid')
    )
    op.create_index(op.f('ix_chess_games_ended_at'), 'chess_games', ['ended_at'], unique=False)
    op.create_index(op.f('ix_chess_games_time_class'), 'chess_games', ['time_class'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_chess_games_time_class'), table_name='chess_games')
    op.drop_index(op.f('ix_chess_games_ended_at'), table_name='chess_games')
    op.drop_table('chess_games')
