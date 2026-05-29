"""add_password_reset_requests_table

Revision ID: a1b2c3d4e5f6
Revises: 
Create Date: 2026-05-29

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'password_reset_requests',
        sa.Column('id', sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column('user_id', sa.CHAR(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column(
            'status',
            sa.Enum('pending', 'approved', 'rejected', name='resetrequeststatus'),
            nullable=False,
            server_default='pending',
            index=True,
        ),
        sa.Column('requested_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_by', sa.CHAR(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('reset_token', sa.String(512), nullable=True),
        sa.Column('reset_token_expires_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_password_reset_requests_status', 'password_reset_requests', ['status'])
    op.create_index('ix_password_reset_requests_user_id', 'password_reset_requests', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_password_reset_requests_user_id', table_name='password_reset_requests')
    op.drop_index('ix_password_reset_requests_status', table_name='password_reset_requests')
    op.drop_table('password_reset_requests')
    op.execute("DROP TYPE IF EXISTS resetrequeststatus")
