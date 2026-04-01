"""fix_circular_fk_users_sites

Revision ID: 0ed682cb2e08
Revises: c01ff0394fd5
Create Date: 2026-03-21 14:32:58.798722

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0ed682cb2e08'
down_revision: Union[str, None] = 'c01ff0394fd5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint('uq_report_site_date_user', 'daily_reports', ['site_id', 'report_date', 'created_by'])
    op.create_foreign_key('fk_daily_reports_approved_by', 'daily_reports', 'users', ['approved_by'], ['id'])
    op.create_foreign_key('fk_users_current_site_id',     'users', 'sites',     ['current_site_id'], ['id'], use_alter=True)
    op.create_foreign_key('fk_users_employee_id',         'users', 'employees', ['employee_id'],     ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_users_employee_id',         'users',         type_='foreignkey')
    op.drop_constraint('fk_users_current_site_id',     'users',         type_='foreignkey')
    op.drop_constraint('fk_daily_reports_approved_by', 'daily_reports', type_='foreignkey')
    op.drop_constraint('uq_report_site_date_user',     'daily_reports', type_='unique')
