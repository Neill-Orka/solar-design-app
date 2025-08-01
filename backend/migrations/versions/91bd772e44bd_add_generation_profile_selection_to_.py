"""Add generation profile selection to projects

Revision ID: 91bd772e44bd
Revises: 1d04b6a84eee
Create Date: 2025-07-25 16:14:50.370898

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '91bd772e44bd'
down_revision = '1d04b6a84eee'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.add_column(sa.Column('use_pvgis', sa.Boolean(), nullable=False, server_default='false'))
        batch_op.add_column(sa.Column('generation_profile_name', sa.String(length=100), nullable=True, server_default='midrand_ew_5'))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.drop_column('generation_profile_name')
        batch_op.drop_column('use_pvgis')

    # ### end Alembic commands ###
