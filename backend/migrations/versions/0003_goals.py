"""goals

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-02 14:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('goals',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('steps', sa.Integer(), nullable=True),
    sa.Column('calories_in', sa.Float(), nullable=True),
    sa.Column('protein_g', sa.Float(), nullable=True),
    sa.Column('carbs_g', sa.Float(), nullable=True),
    sa.Column('fat_g', sa.Float(), nullable=True),
    sa.Column('sleep_hours', sa.Float(), nullable=True),
    sa.Column('workouts_per_week', sa.Integer(), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('goals')
