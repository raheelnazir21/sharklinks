"""
EmailOrderTracker Model.
Stores Gmail-detected order emails and tracks whether they have been
created in the production tool. Powers the accountability reminder system.
"""
import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, DateTime, Text, JSON, Boolean, Enum
)
from app.core.database import Base
from app.models.user import GUID


class EmailTrackerStatus(str, enum.Enum):
    pending    = "pending"     # Email detected, order not yet in tool
    matched    = "matched"     # Order found and linked in tool
    expired    = "expired"     # Reminders exhausted — escalated to super admin
    ignored    = "ignored"     # Manually dismissed by admin (not an order email)


class EmailOrderTracker(Base):
    """
    One row per Gmail message that appears to be an order communication.
    The scanner creates this record; the matcher updates it once a corresponding
    order is found in the orders table.
    """
    __tablename__ = "email_order_tracker"

    id                  = Column(GUID(), primary_key=True, default=uuid.uuid4)

    # ─── Gmail identifiers ────────────────────────────────────────────────────
    gmail_message_id    = Column(String(200), unique=True, nullable=False, index=True)
    gmail_thread_id     = Column(String(200), nullable=True, index=True)

    # ─── Email metadata ───────────────────────────────────────────────────────
    subject             = Column(String(500), nullable=True)
    sender_email        = Column(String(255), nullable=True)
    recipient_emails    = Column(JSON, default=list)   # list[str] — TO + CC addresses
    body_snippet        = Column(Text, nullable=True)  # first ~500 chars of body
    email_date          = Column(DateTime, nullable=True)  # When Gmail message was sent

    # ─── Extracted order hints (parsed from subject/body) ────────────────────
    detected_order_no   = Column(String(200), nullable=True)
    detected_style_name = Column(String(200), nullable=True)
    detected_quantity   = Column(Integer, nullable=True)
    detected_keywords   = Column(JSON, default=list)   # list of matched keywords

    # ─── Matching state ───────────────────────────────────────────────────────
    matched_order_id    = Column(GUID(), nullable=True)   # FK to orders.id once matched
    matched_at          = Column(DateTime, nullable=True)
    matched_by          = Column(GUID(), nullable=True)   # user who manually linked it

    # ─── Reminder / escalation tracking ──────────────────────────────────────
    first_reminder_sent_at      = Column(DateTime, nullable=True)   # 24h reminder
    second_reminder_sent_at     = Column(DateTime, nullable=True)   # 48h reminder
    escalation_sent_at          = Column(DateTime, nullable=True)   # 72h escalation

    # ─── Status & control ────────────────────────────────────────────────────
    status              = Column(Enum(EmailTrackerStatus), default=EmailTrackerStatus.pending, nullable=False)
    ignore_reason       = Column(String(300), nullable=True)   # filled if admin marks ignored
    notes               = Column(Text, nullable=True)

    # ─── Audit ───────────────────────────────────────────────────────────────
    scanned_at          = Column(DateTime, default=datetime.utcnow)   # when our scanner first saw it
    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
