"""chess pgn

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-05 16:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0005'
down_revision: Union[str, None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('chess_games', sa.Column('pgn', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('chess_games', 'pgn')
