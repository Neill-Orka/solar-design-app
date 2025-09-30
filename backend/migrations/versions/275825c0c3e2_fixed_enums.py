"""Fixed enums

Revision ID: 275825c0c3e2
Revises: 0d7e76bc1d86
Create Date: 2025-09-30 09:58:42.497016

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '275825c0c3e2'
down_revision = '0d7e76bc1d86'
branch_labels = None
depends_on = None


def upgrade():
    # 0) Make sure the shared ENUM exists and has all values (idempotent)
    op.execute("""
    DO $$
    BEGIN
        -- create type if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
            CREATE TYPE userrole AS ENUM ('ADMIN','MANAGER','SALES','DESIGN','TEAM_LEADER','TECHNICIAN');
        END IF;

        -- add any missing labels safely
        BEGIN
            ALTER TYPE userrole ADD VALUE 'MANAGER';
        EXCEPTION WHEN duplicate_object THEN NULL; END;

        BEGIN
            ALTER TYPE userrole ADD VALUE 'TEAM_LEADER';
        EXCEPTION WHEN duplicate_object THEN NULL; END;

        BEGIN
            ALTER TYPE userrole ADD VALUE 'TECHNICIAN';
        EXCEPTION WHEN duplicate_object THEN NULL; END;
    END
    $$;
    """)

    # 1) Normalize data so cast will succeed (UPPER + replace spaces -> underscores)
    op.execute("UPDATE registration_tokens SET role = REPLACE(UPPER(role), ' ', '_');")

    # 2) Drop the old CHECK constraint if it exists (it referenced the 3-value list)
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'registration_tokens_role_check'
        ) THEN
            ALTER TABLE registration_tokens DROP CONSTRAINT registration_tokens_role_check;
        END IF;
    END
    $$;
    """)

    # 3) Cast the column to the shared ENUM using USING clause
    with op.batch_alter_table("registration_tokens") as batch_op:
        batch_op.alter_column(
            "role",
            existing_type=sa.VARCHAR(length=30),
            type_=sa.Enum(
                "ADMIN","MANAGER","SALES","DESIGN","TEAM_LEADER","TECHNICIAN",
                name="userrole",
            ),
            postgresql_using="role::userrole",
            existing_nullable=False,
        )

    # ### end Alembic commands ###


def downgrade():
    # Revert back to VARCHAR(30) and recreate the old CHECK
    with op.batch_alter_table("registration_tokens") as batch_op:
        batch_op.alter_column(
            "role",
            existing_type=sa.Enum(
                "ADMIN","MANAGER","SALES","DESIGN","TEAM_LEADER","TECHNICIAN",
                name="userrole",
            ),
            type_=sa.VARCHAR(length=30),
            postgresql_using="role::text",
            existing_nullable=False,
        )

        # restore original 3-value check constraint
        batch_op.create_check_constraint(
            "registration_tokens_role_check",
            "role = ANY (ARRAY['ADMIN','SALES','DESIGN'])"
        )

    # ### end Alembic commands ###
