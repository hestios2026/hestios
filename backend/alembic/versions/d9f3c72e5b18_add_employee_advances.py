"""add_employee_advances

Revision ID: d9f3c72e5b18
Revises: c4e8a91b2f37
Create Date: 2026-05-08 09:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd9f3c72e5b18'
down_revision: Union[str, None] = 'c4e8a91b2f37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'employee_advances',
        sa.Column('id',           sa.Integer(),     primary_key=True, index=True),
        sa.Column('employee_id',  sa.Integer(),     sa.ForeignKey('employees.id'), nullable=False),
        sa.Column('amount',       sa.Float(),       nullable=False),
        sa.Column('currency',     sa.String(3),     server_default='EUR'),
        sa.Column('date',         sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('description',  sa.String(500),   nullable=True),
        sa.Column('site_id',      sa.Integer(),     sa.ForeignKey('sites.id'), nullable=True),
        sa.Column('recorded_by',  sa.Integer(),     sa.ForeignKey('users.id'), nullable=True),
        sa.Column('settled',      sa.Boolean(),     server_default='false'),
        sa.Column('settled_at',   sa.DateTime(timezone=True), nullable=True),
        sa.Column('settled_note', sa.Text(),        nullable=True),
        sa.Column('notes',        sa.Text(),        nullable=True),
        sa.Column('created_at',   sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('employee_advances')
