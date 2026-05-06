"""add_unit_price_supplier_cost_id_to_material_logs

Revision ID: a3f9e12d4c87
Revises: 7847c98cb5f5
Create Date: 2026-04-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a3f9e12d4c87'
down_revision: Union[str, None] = '7847c98cb5f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('material_logs', sa.Column('unit_price', sa.Float(), nullable=True))
    op.add_column('material_logs', sa.Column('supplier', sa.String(), nullable=True))
    op.add_column('material_logs', sa.Column('invoice_ref', sa.String(), nullable=True))
    op.add_column('material_logs', sa.Column('cost_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_material_logs_cost_id', 'material_logs', 'costs',
        ['cost_id'], ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_material_logs_cost_id', 'material_logs', type_='foreignkey')
    op.drop_column('material_logs', 'cost_id')
    op.drop_column('material_logs', 'invoice_ref')
    op.drop_column('material_logs', 'supplier')
    op.drop_column('material_logs', 'unit_price')
