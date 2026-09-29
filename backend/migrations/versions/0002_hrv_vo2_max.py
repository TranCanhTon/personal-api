"""add hrv and vo2 max

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-29 13:20:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('heart_rate_daily', sa.Column('hrv_ms', sa.Float(), nullable=True))
    op.add_column('daily_fitness', sa.Column('vo2_max', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('daily_fitness', 'vo2_max')
    op.drop_column('heart_rate_daily', 'hrv_ms')
