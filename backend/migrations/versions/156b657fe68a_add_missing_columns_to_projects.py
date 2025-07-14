"""add missing columns to projects

Revision ID: 156b657fe68a
Revises: d00eeffa1866
Create Date: 2025-07-11 16:12:59.007459

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '156b657fe68a'
down_revision = 'd00eeffa1866'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c['name'] for c in insp.get_columns('projects')]
    if 'tariff_id' not in cols:
        op.add_column('projects',
                      sa.Column('tariff_id', sa.Integer(), nullable=True)
                      )
    if 'custom_flat_rate' not in cols:
        op.add_column('projects',
                      sa.Column('custom_flat_rate', sa.Numeric(precision=10, scale=4), nullable=True)
                      )

def downgrade():
    if op.get_bind().dialect.has_table(op.get_bind(), 'projects'):
        # only drop tariff_id if you really want to roll it back
        op.drop_column('projects', 'custom_flat_rate')
        op.drop_column('projects', 'tariff_id')
