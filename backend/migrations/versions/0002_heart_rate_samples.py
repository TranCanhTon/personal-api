"""heart rate samples

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-30 16:10:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('heart_rate_samples',
    sa.Column('ts', sa.DateTime(timezone=True), nullable=False),
    sa.Column('min', sa.Float(), nullable=True),
    sa.Column('avg', sa.Float(), nullable=True),
    sa.Column('max', sa.Float(), nullable=True),
    sa.PrimaryKeyConstraint('ts')
    )


def downgrade() -> None:
    op.drop_table('heart_rate_samples')
