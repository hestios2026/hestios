"""add_employee_anmeldung_heirat_equipment_fields

Revision ID: 7847c98cb5f5
Revises: 018702ce415c
Create Date: 2026-04-22 17:04:45.553307

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7847c98cb5f5'
down_revision: Union[str, None] = '018702ce415c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('employees', sa.Column('anmeldung_status', sa.String(50), nullable=True))
    op.add_column('employees', sa.Column('heiratsort', sa.String(100), nullable=True))
    op.add_column('employees', sa.Column('heiratsdatum', sa.Date(), nullable=True))
    op.add_column('employees', sa.Column('schuhgroesse', sa.String(10), nullable=True))
    op.add_column('employees', sa.Column('kleidergroesse', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('employees', 'kleidergroesse')
    op.drop_column('employees', 'schuhgroesse')
    op.drop_column('employees', 'heiratsdatum')
    op.drop_column('employees', 'heiratsort')
    op.drop_column('employees', 'anmeldung_status')
