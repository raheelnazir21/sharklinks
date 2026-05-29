"""
PasswordResetRequest model — stores user-submitted reset requests
that an admin must approve or reject before a token is generated.
"""
import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.user import GUID


class ResetRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class PasswordResetRequest(Base):
    """
    Tracks every forgot-password request submitted by users.
    Admin must approve before a reset token is issued.
    """
    __tablename__ = "password_reset_requests"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    status = Column(
        Enum(ResetRequestStatus),
        default=ResetRequestStatus.pending,
        nullable=False,
        index=True,
    )
    requested_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    # One-time reset token — only set after admin approval
    reset_token = Column(String(512), nullable=True)
    reset_token_expires_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="reset_requests")
    resolver = relationship("User", foreign_keys=[resolved_by])
