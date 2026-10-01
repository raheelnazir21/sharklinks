"""
Comments & Notifications Models.
- StageComment: threaded comments per production stage (replaces single remarks textarea)
- Notification: per-user alert notifications for stage deadlines and ex-factory events
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, JSON
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
    title = Column(String(500), nullable=False)
    message = Column(Text, nullable=False)
    html_content = Column(Text, nullable=True)

    # Category: zone_1_ex_factory_passed | zone_2_stage_delayed | order_created | class_created | general
    category = Column(String(50), nullable=True, default="general")

    # Type: stage_overdue | ex_factory_approaching | ex_factory_passed | stage_completed | qc_alert | order_created | class_created
    type = Column(String(50), nullable=False, default="stage_overdue")

    # Optional links back to the source entity
    order_id = Column(GUID(), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    stage_id = Column(GUID(), ForeignKey("production_stages.id", ondelete="SET NULL"), nullable=True)
    class_id = Column(GUID(), nullable=True)

    # Structured metadata (delay days, vendor name, CAPA details, etc.)
    extra_data = Column(JSON, nullable=True, default=dict)

    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
    order = relationship("Order", foreign_keys=[order_id])

