"""add_equipment_id_to_costs

Revision ID: c4e8a91b2f37
Revises: b7d2f83a1e56
Create Date: 2026-05-06 15:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c4e8a91b2f37'
down_revision: Union[str, None] = 'b7d2f83a1e56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('costs', sa.Column('equipment_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_costs_equipment_id', 'costs', 'equipment',
        ['equipment_id'], ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_costs_equipment_id', 'costs', type_='foreignkey')
    op.drop_column('costs', 'equipment_id')
