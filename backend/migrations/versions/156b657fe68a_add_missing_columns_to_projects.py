"""add missing columns to projects

Revision ID: 156b657fe68a
Revises: d00eeffa1866
Create Date: 2025-07-11 16:12:59.007459

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '156b657fe68a'
down_revision = 'd00eeffa1866'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('projects', sa.Column('tariff_id', sa.Integer(), nullable=True))
    op.add_column('projects', sa.Column('custom_flat_rate', sa.Numeric(precision=10, scale=4), nullable=True))

def downgrade():
    op.drop_column('projects', 'custom_flat_rate')
    op.drop_column('projects', 'tariff_id')
