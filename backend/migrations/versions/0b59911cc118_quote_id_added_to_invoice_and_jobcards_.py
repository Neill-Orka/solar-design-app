"""quote id added to invoice and jobcards tables

Revision ID: 0b59911cc118
Revises: 9269a04048ab
Create Date: 2025-10-15 14:16:34.006478
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0b59911cc118'
down_revision = '9269a04048ab'
branch_labels = None
depends_on = None


def upgrade():
    # ---- invoices: add quote_id + FK ----
    with op.batch_alter_table('invoices', schema=None) as batch_op:
        batch_op.add_column(sa.Column('quote_id', sa.Integer(), nullable=True))
        # keep Alembic naming convention / server-side naming
        batch_op.create_foreign_key(None, 'documents', ['quote_id'], ['id'])

    # ---- job_cards: add quote_id + FK ----
    with op.batch_alter_table('job_cards', schema=None) as batch_op:
        batch_op.add_column(sa.Column('quote_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(None, 'documents', ['quote_id'], ['id'])

    # ---- indexes (idempotent; use raw SQL with IF NOT EXISTS) ----
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_attachments_job_card_id ON job_card_attachments (job_card_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_attachments_uploaded_by ON job_card_attachments (uploaded_by_id)"))

    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_materials_job_card_id ON job_card_materials (job_card_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_materials_product_id ON job_card_materials (product_id)"))

    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_time_entries_job_card_id ON job_card_time_entries (job_card_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_time_entries_user_id ON job_card_time_entries (user_id)"))

    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_job_cards_category_id ON job_cards (category_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_job_cards_client_id ON job_cards (client_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_job_cards_owner_id ON job_cards (owner_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_job_cards_project_id ON job_cards (project_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_job_cards_status ON job_cards (status)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_job_cards_vehicle_id ON job_cards (vehicle_id)"))


def downgrade():
    # ---- drop indexes (idempotent) ----
    op.execute(sa.text("DROP INDEX IF EXISTS ix_job_cards_vehicle_id"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_job_cards_status"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_job_cards_project_id"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_job_cards_owner_id"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_job_cards_client_id"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_job_cards_category_id"))

    op.execute(sa.text("DROP INDEX IF EXISTS ix_time_entries_user_id"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_time_entries_job_card_id"))

    op.execute(sa.text("DROP INDEX IF EXISTS ix_materials_product_id"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_materials_job_card_id"))

    op.execute(sa.text("DROP INDEX IF EXISTS ix_attachments_uploaded_by"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_attachments_job_card_id"))

    # ---- drop FKs + columns ----
    with op.batch_alter_table('job_cards', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_column('quote_id')

    with op.batch_alter_table('invoices', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_column('quote_id')
