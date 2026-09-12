"""
Comments & Notifications Models.
- StageComment: threaded comments per production stage (replaces single remarks textarea)
- Notification: per-user alert notifications for stage deadlines and ex-factory events
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.user import GUID


class StageComment(Base):
    __tablename__ = "stage_comments"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    stage_id = Column(GUID(), ForeignKey("production_stages.id", ondelete="CASCADE"), nullable=False)
    order_id = Column(GUID(), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    text = Column(Text, nullable=False)
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    author = relationship("User", foreign_keys=[created_by])


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Notification content
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)

    # Type: stage_overdue | ex_factory_approaching | ex_factory_passed | stage_completed | qc_alert
    type = Column(String(50), nullable=False, default="stage_overdue")

    # Optional links back to the source entity
    order_id = Column(GUID(), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    stage_id = Column(GUID(), ForeignKey("production_stages.id", ondelete="SET NULL"), nullable=True)

    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
    order = relationship("Order", foreign_keys=[order_id])
