"""
QC & QA Management Models — Defect Master & Inspection Reports.
Digitalized workflow for: Cut Panel, Inline, End Line, Finishing, and QA Audit.

Includes:
  - Multi-defect per row (QCReportItemDefect)
  - Per-hour batch size on QCReportItem
  - QC report file attachments (QCReportAttachment)
  - Operator traffic-light flag system (OperatorFlag, OperatorFlagHistory)
  - Article Code & Product Color master data
"""
import enum
import uuid
from datetime import datetime, date
from sqlalchemy import (
    Boolean, BigInteger, Column, DateTime, Date, Enum, ForeignKey,
    Integer, String, Text, Float, JSON
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.user import GUID


class QCReportType(str, enum.Enum):
    cut_panel = "cut_panel"
    inline = "inline"
    end_line = "end_line"
    finishing = "finishing"
    qa_audit = "qa_audit"


class ReportStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    approved = "approved"
    rejected = "rejected"


class DefectSeverity(str, enum.Enum):
    minor = "minor"
    major = "major"
    critical = "critical"


class DefectCategory(Base):
    """
    Categorizes defects (e.g. Sewing, Fabric, Cutting) for specific report types.
    """
    __tablename__ = "qc_defect_categories"

    id = Column(Integer, primary_key=True, index=True)
    report_type = Column(Enum(QCReportType), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    status = Column(Boolean, default=True)

    defects = relationship("DefectCode", back_populates="category", cascade="all, delete-orphan")


class DefectCode(Base):
    """
    Master data for defect types. Picked during inspection.
    Each report type has its own filtered list of defects.
    """
    __tablename__ = "qc_defect_codes"

    id = Column(Integer, primary_key=True, index=True)
    report_type = Column(Enum(QCReportType), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("qc_defect_categories.id"), nullable=True)
    name = Column(String(200), nullable=False)
    code = Column(String(50), nullable=False, index=True)
    severity = Column(Enum(DefectSeverity), default=DefectSeverity.major)
    status = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    category = relationship("DefectCategory", back_populates="defects")
    report_items = relationship("QCReportItem", back_populates="defect")


class QCReport(Base):
    """
    QC Inspection Report Header.
    Integrates with Vendor -> Floor -> Line system.
    """
    __tablename__ = "qc_reports_v2" # Using V2 to avoid conflicts with old schema if any

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    report_type = Column(Enum(QCReportType), nullable=False, index=True)
    
    # Header Info
    vendor_id = Column(GUID(), ForeignKey("vendors.id"), nullable=False, index=True)
    floor_id = Column(GUID(), ForeignKey("vendor_floors.id"), nullable=True)
    line_id = Column(GUID(), ForeignKey("vendor_lines.id"), nullable=True)
    order_id = Column(GUID(), ForeignKey("orders.id"), nullable=False, index=True) # PO/Style
    
    auditor_id = Column(GUID(), ForeignKey("users.id"), nullable=True)
    auditor_name = Column(String(150), nullable=True) # Manual override or snapshot
    auditor_code = Column(String(50), nullable=True)
    
    inspection_date = Column(Date, default=date.today)
    shift = Column(String(50), nullable=True) # A, B, C
    batch_number = Column(String(100), nullable=True)
    stage = Column(String(100), nullable=True)
    inspection_type = Column(String(100), nullable=True) # First/Final/Re-audit
    color = Column(String(100), nullable=True)
    stm = Column(String(100), nullable=True)

    # Performance Quantities
    quantity_checked = Column(Integer, default=0)
    quantity_passed = Column(Integer, default=0)
    quantity_rejected = Column(Integer, default=0)
    total_defects = Column(Integer, default=0)
    
    # Auto-calculations
    dhu_percent = Column(Float, default=0.0)
    fpy_percent = Column(Float, default=0.0)
    pass_percent = Column(Float, default=0.0)
    reject_percent = Column(Float, default=0.0)

    # Severity Counts
    critical_count = Column(Integer, default=0)
    major_count = Column(Integer, default=0)
    minor_count = Column(Integer, default=0)

    status = Column(Enum(ReportStatus), default=ReportStatus.draft, index=True)
    remarks = Column(Text, nullable=True)
    
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Article & Color linkage (Track 3)
    article_code_id = Column(GUID(), ForeignKey("article_codes.id"), nullable=True)
    product_color_id = Column(GUID(), ForeignKey("product_colors.id"), nullable=True)

    # Relationships
    vendor = relationship("Vendor")
    floor = relationship("VendorFloor")
    line = relationship("VendorLine")
    order = relationship("Order")
    auditor = relationship("User", foreign_keys=[auditor_id])
    items = relationship("QCReportItem", back_populates="report", cascade="all, delete-orphan")
    attachments = relationship("QCReportAttachment", back_populates="report", cascade="all, delete-orphan")
    article_code = relationship("ArticleCode", foreign_keys=[article_code_id])
    product_color = relationship("ProductColor", foreign_keys=[product_color_id])


class QCReportItem(Base):
    """
    A time-slot row inside a QC report (keyed by hour + date).
    Multiple defects per row are stored in QCReportItemDefect (child table).
    defect_id kept for backward compatibility with existing single-defect rows.
    """
    __tablename__ = "qc_report_items_v2"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    report_id = Column(GUID(), ForeignKey("qc_reports_v2.id"), nullable=False, index=True)

    operation = Column(String(200), nullable=True)       # Deprecated but kept for compatibility
    hour = Column(String(50), nullable=True)             # Hour slot (e.g. 09:00 - 10:00)
    batch_size = Column(Integer, default=0)              # Units checked in this hour
    item_date = Column(Date, default=date.today)         # Date for this specific row

    # Legacy single-defect columns (kept for backward compatibility)
    defect_id = Column(Integer, ForeignKey("qc_defect_codes.id"), nullable=True)
    defect_count = Column(Integer, default=0)
    severity = Column(Enum(DefectSeverity), nullable=True)

    corrective_action = Column(String(500), nullable=True)
    remarks = Column(Text, nullable=True)

    # Operator context for this hour
    operator_number = Column(String(50), nullable=True)
    operator_flag = Column(String(20), default="green") # green, orange, red

    report = relationship("QCReport", back_populates="items")
    defect = relationship("DefectCode", back_populates="report_items")
    # New: multiple defects per row
    defect_entries = relationship("QCReportItemDefect", back_populates="item", cascade="all, delete-orphan")


class QCReportItemDefect(Base):
    """
    Child table: links one QCReportItem row to many defect codes.
    Replaces the single defect_id pattern for multi-defect support.
    """
    __tablename__ = "qc_report_item_defects"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    item_id = Column(GUID(), ForeignKey("qc_report_items_v2.id"), nullable=False, index=True)
    defect_id = Column(Integer, ForeignKey("qc_defect_codes.id"), nullable=False)
    defect_count = Column(Integer, default=1)
    severity = Column(Enum(DefectSeverity), nullable=True)

    item = relationship("QCReportItem", back_populates="defect_entries")
    defect = relationship("DefectCode")


class QCReportAttachment(Base):
    """
    Files uploaded against a QC report (photos, PDFs, Word docs, etc.).
    Stored on the local filesystem under uploads/qc_attachments/.
    """
    __tablename__ = "qc_report_attachments"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    report_id = Column(GUID(), ForeignKey("qc_reports_v2.id"), nullable=False, index=True)
    file_name = Column(String(300), nullable=False)
    file_path = Column(String(500), nullable=False)   # Server-side relative path
    mime_type = Column(String(100), nullable=True)
    file_size = Column(BigInteger, default=0)          # Bytes
    uploaded_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    report = relationship("QCReport", back_populates="attachments")
    uploader = relationship("User", foreign_keys=[uploaded_by])


# ─── Track 2: Operator Traffic-Light Flagging ─────────────────────────────────

class FlagColor(str, enum.Enum):
    green  = "green"
    orange = "orange"
    red    = "red"


class OperatorFlag(Base):
    """
    Flags a specific operator position on a line for repeatedly causing defects.
    Traffic-light: green (ok) → orange (monitor) → red (corrective action required).
    """
    __tablename__ = "operator_flags"

    id                = Column(GUID(), primary_key=True, default=uuid.uuid4)
    line_id           = Column(GUID(), ForeignKey("vendor_lines.id"), nullable=False, index=True)
    operator_number   = Column(Integer, nullable=False)        # Position (1-N)
    operator_name     = Column(String(150), nullable=True)
    flag_color        = Column(Enum(FlagColor), default=FlagColor.green, nullable=False)
    defect_id         = Column(Integer, ForeignKey("qc_defect_codes.id"), nullable=True)
    note              = Column(Text, nullable=True)
    corrective_action = Column(Text, nullable=True)
    flagged_by        = Column(GUID(), ForeignKey("users.id"), nullable=True)
    flagged_at        = Column(DateTime, default=datetime.utcnow)
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    line    = relationship("VendorLine")
    defect  = relationship("DefectCode")
    flagger = relationship("User", foreign_keys=[flagged_by])
    history = relationship("OperatorFlagHistory", back_populates="flag", cascade="all, delete-orphan")


class OperatorFlagHistory(Base):
    """Immutable audit log of every flag colour change for an operator."""
    __tablename__ = "operator_flag_history"

    id               = Column(GUID(), primary_key=True, default=uuid.uuid4)
    operator_flag_id = Column(GUID(), ForeignKey("operator_flags.id"), nullable=False, index=True)
    old_color        = Column(Enum(FlagColor), nullable=True)
    new_color        = Column(Enum(FlagColor), nullable=False)
    changed_by       = Column(GUID(), ForeignKey("users.id"), nullable=True)
    changed_at       = Column(DateTime, default=datetime.utcnow)
    note             = Column(Text, nullable=True)

    flag            = relationship("OperatorFlag", back_populates="history")
    changed_by_user = relationship("User", foreign_keys=[changed_by])


# ─── Track 3: Article Code & Product Color ────────────────────────────────────

class ArticleCode(Base):
    """
    Master record for an article code (e.g. ART-2024-001).
    Each article belongs to a product and can be linked to Bulk or Sampling orders.
    """
    __tablename__ = "article_codes"

    id           = Column(GUID(), primary_key=True, default=uuid.uuid4)
    code         = Column(String(100), nullable=False, unique=True, index=True)
    name         = Column(String(200), nullable=True)
    product_name = Column(String(200), nullable=True)   # Denormalized for simplicity
    track_type   = Column(String(20), default="both")   # 'bulk' | 'sample' | 'both'
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime, default=datetime.utcnow)

    colors = relationship("ProductColor", back_populates="article", cascade="all, delete-orphan")


class ProductColor(Base):
    """
    A color variant belonging to an ArticleCode.
    One article → many colors (one-to-many).
    """
    __tablename__ = "product_colors"

    id          = Column(GUID(), primary_key=True, default=uuid.uuid4)
    article_id  = Column(GUID(), ForeignKey("article_codes.id"), nullable=False, index=True)
    color_name  = Column(String(100), nullable=False)    # e.g. "Navy Blue"
    color_hex   = Column(String(10), nullable=True)      # Optional hex swatch e.g. "#1B2A4A"
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    article = relationship("ArticleCode", back_populates="colors")
