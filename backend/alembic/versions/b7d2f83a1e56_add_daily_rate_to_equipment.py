"""add_daily_rate_to_equipment

Revision ID: b7d2f83a1e56
Revises: a3f9e12d4c87
Create Date: 2026-05-06 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b7d2f83a1e56'
down_revision: Union[str, None] = 'a3f9e12d4c87'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('equipment', sa.Column('daily_rate', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('equipment', 'daily_rate')
