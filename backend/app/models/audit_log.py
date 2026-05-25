import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.user import GUID


class AuditLog(Base):
    """
    Records every important action in the system.
    Answers: WHO did WHAT to WHICH record and WHEN.
    Used for compliance, traceability, and factory audits.
    """
    __tablename__ = "audit_logs"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)       # e.g. "approved", "rejected", "created"
    entity_type = Column(String(100), nullable=False)  # e.g. "QCReport", "Order"
    entity_id = Column(String(100), nullable=False)    # the ID of the record changed
    payload = Column(Text, nullable=True)              # JSON details of the change
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
