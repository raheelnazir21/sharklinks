"""
Pre-Order Request Model.
Represents an order that has been communicated (verbally, via email, WhatsApp, etc.)
but has not yet been formally created in the production tracking tool.

Lifecycle:
  pending   → A team member submitted a pre-order and tagged a manager.
  processed → The manager created the actual order in the tool and linked it.
  overdue   → 48 hours passed with no action taken.
  ignored   → Admin manually dismissed (e.g. was not a real order).
"""
import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, JSON, Boolean, Enum, Date
from app.core.database import Base
from app.models.user import GUID


class PreOrderStatus(str, enum.Enum):
    pending   = "pending"
    partial   = "partial"
    processed = "processed"
    overdue   = "overdue"
    ignored   = "ignored"


class PreOrderCategory(str, enum.Enum):
    bulk     = "bulk"
    sampling = "sampling"


class PreOrderPriority(str, enum.Enum):
    low    = "low"
    normal = "normal"
    high   = "high"
    urgent = "urgent"


class PreOrderRequest(Base):
    __tablename__ = "pre_order_requests"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)

    # ─── Order Details ────────────────────────────────────────────────────────
    class_name              = Column(Text, nullable=False)
    category                = Column(Enum(PreOrderCategory), nullable=False)
    style_name              = Column(Text, nullable=True)
    customer                = Column(String(500), nullable=True)
    reference_po            = Column(String(500), nullable=True)   # External PO / reference number
    quantity                = Column(Integer, nullable=True)        # Total garment pieces (e.g. 500 pcs)
    total_product_count     = Column(Integer, nullable=False, default=1)  # Number of products/styles to create
    processed_product_count = Column(Integer, nullable=False, default=0)  # Number of products created so far
    ex_factory_date         = Column(Date, nullable=True)
    priority                = Column(Enum(PreOrderPriority), default=PreOrderPriority.normal, nullable=False)
    notes                   = Column(Text, nullable=True)

    # ─── Assignment ───────────────────────────────────────────────────────────
    vendor_id            = Column(GUID(), nullable=True)          # Optional vendor reference
    assigned_manager_id  = Column(GUID(), nullable=False)         # Manager who must process it
    assigned_by_id       = Column(GUID(), nullable=False)         # Who submitted the request
    assigned_at          = Column(DateTime, default=datetime.utcnow)

    # ─── Processing / Linking ─────────────────────────────────────────────────
    linked_class_id  = Column(GUID(), nullable=True)    # FK to bulk_classes.id or sample_classes.id
    linked_order_id  = Column(String(500), nullable=True)  # PO numbers created under this pre-order
    linked_at        = Column(DateTime, nullable=True)  # When the order was created
    linked_by_id     = Column(GUID(), nullable=True)    # Who linked it (manager or admin)

    # ─── Notification tracking ────────────────────────────────────────────────
    assignment_email_sent_at  = Column(DateTime, nullable=True)  # Instant email on creation
    first_reminder_sent_at    = Column(DateTime, nullable=True)  # 24h reminder
    second_reminder_sent_at   = Column(DateTime, nullable=True)  # 48h reminder
    escalation_sent_at        = Column(DateTime, nullable=True)  # 72h escalation

    # ─── Status ───────────────────────────────────────────────────────────────
    status        = Column(Enum(PreOrderStatus), default=PreOrderStatus.pending, nullable=False)
    ignore_reason = Column(String(300), nullable=True)

    # ─── Audit ───────────────────────────────────────────────────────────────
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
