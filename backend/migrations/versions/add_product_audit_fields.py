"""Add audit fields to products

Revision ID: add_product_audit_fields
Revises: c9ef245080ae
Create Date: 2025-08-19
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_product_audit_fields'
down_revision = 'c9ef245080ae'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('products', sa.Column('updated_at', sa.DateTime(), nullable=True))
    op.add_column('products', sa.Column('updated_by_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_products_updated_by', 'products', 'users', ['updated_by_id'], ['id'])


def downgrade():
    op.drop_constraint('fk_products_updated_by', 'products', type_='foreignkey')
    op.drop_column('products', 'updated_by_id')
    op.drop_column('products', 'updated_at')
