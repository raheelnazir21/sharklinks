"""
Advanced QC Report Models: Inline QC, Finish QC, Endline QC
Enterprise-grade garment factory quality management models.
"""
import enum
import uuid
from datetime import datetime, date
from sqlalchemy import (
    Boolean, Column, DateTime, Date, Enum, ForeignKey,
    Integer, String, Text, Float, JSON
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.user import GUID


# ─── Enums ────────────────────────────────────────────────────────────────────

class TrafficLightStatus(str, enum.Enum):
    green  = "green"
    yellow = "yellow"
    red    = "red"

class AQLResult(str, enum.Enum):
    pass_  = "pass"
    fail   = "fail"
    pending = "pending"

class QCShift(str, enum.Enum):
    day     = "Day Shift"
    night   = "Night Shift"
    morning = "Morning Shift"

class FinishReportType(str, enum.Enum):
    finish  = "finish"
    endline = "endline"


# ─── CUT PANEL QC REPORT ─────────────────────────────────────────────────────

class CutPanelReport(Base):
    """
    Lot-wise cut panel inspection report.
    Tracks cutting, printing/embroidery, knitting and dyeing defects by bundle.
    """
    __tablename__ = "cut_panel_reports"

    id               = Column(GUID(), primary_key=True, default=uuid.uuid4)
    vendor_id        = Column(GUID(), ForeignKey("vendors.id"), nullable=True)
    floor_id         = Column(GUID(), ForeignKey("vendor_floors.id"), nullable=True)
    line_id          = Column(GUID(), ForeignKey("vendor_lines.id"), nullable=True)
    report_date      = Column(Date, default=date.today)
    style_no         = Column(String(100), nullable=True)
    po_number        = Column(String(100), nullable=True)
    article_code     = Column(String(100), nullable=True)
    product_color    = Column(String(100), nullable=True)
    shift            = Column(String(50), nullable=True)
    qc_name          = Column(String(150), nullable=True)
    department       = Column(String(100), default="CUTTING")
    model_number     = Column(String(100), nullable=True)
    customer         = Column(String(150), nullable=True)
    stm              = Column(String(100), nullable=True)
    lot_number       = Column(String(100), nullable=True)
    lot_qty          = Column(Integer, default=0)
    total_checked    = Column(Integer, default=0)
    total_defects    = Column(Integer, default=0)
    defect_percent   = Column(Float, default=0.0)
    defect_columns   = Column(JSON, default=[])
    remarks          = Column(Text, nullable=True)
    quality_inspector = Column(String(150), nullable=True)
    quality_supervisor = Column(String(150), nullable=True)
    production_supervisor = Column(String(150), nullable=True)
    created_by       = Column(GUID(), ForeignKey("users.id"), nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vendor = relationship("Vendor")
    floor_rel = relationship("VendorFloor")
    line_rel = relationship("VendorLine")
    rows = relationship("CutPanelReportRow", back_populates="report", cascade="all, delete-orphan", order_by="CutPanelReportRow.row_order")


class CutPanelReportRow(Base):
    __tablename__ = "cut_panel_report_rows"

    id             = Column(GUID(), primary_key=True, default=uuid.uuid4)
    report_id      = Column(GUID(), ForeignKey("cut_panel_reports.id"), nullable=False, index=True)
    row_order      = Column(Integer, default=1)
    bundle_number  = Column(String(100), nullable=True)
    size           = Column(String(50), nullable=True)
    pcs            = Column(Integer, default=0)
    defect_counts  = Column(JSON, default={})
    total_defects  = Column(Integer, default=0)
    defect_percent = Column(Float, default=0.0)

    report = relationship("CutPanelReport", back_populates="rows")


# ─── BATCH AUDIT REPORT ──────────────────────────────────────────────────────

class BatchAuditReport(Base):
    """
    Finishing batch audit report with editable fault library and batch rows.
    """
    __tablename__ = "batch_audit_reports"

    id               = Column(GUID(), primary_key=True, default=uuid.uuid4)
    vendor_id        = Column(GUID(), ForeignKey("vendors.id"), nullable=True)
    floor_id         = Column(GUID(), ForeignKey("vendor_floors.id"), nullable=True)
    line_id          = Column(GUID(), ForeignKey("vendor_lines.id"), nullable=True)
    report_date      = Column(Date, default=date.today)
    issue_date       = Column(Date, nullable=True)
    unit_number      = Column(String(100), nullable=True)
    stm              = Column(String(100), nullable=True)
    style_no         = Column(String(100), nullable=True)
    customer         = Column(String(150), nullable=True)
    product_name     = Column(String(200), nullable=True)
    product_color    = Column(String(100), nullable=True)
    auditor_number   = Column(String(100), nullable=True)
    shift            = Column(String(50), nullable=True)
    qc_name          = Column(String(150), nullable=True)
    department       = Column(String(100), default="FINISHING")
    inspection_level = Column(String(50), nullable=True)
    aql_critical     = Column(String(100), nullable=True)
    aql_major        = Column(String(100), nullable=True)
    zero_tolerance   = Column(String(100), nullable=True)
    fault_library    = Column(JSON, default=[])
    fault_columns    = Column(JSON, default=[])
    total_quantity   = Column(Integer, default=0)
    total_sample_qty = Column(Integer, default=0)
    total_faults     = Column(Integer, default=0)
    first_pass_qty   = Column(Integer, default=0)
    second_pass_qty  = Column(Integer, default=0)
    oqi_percent      = Column(Float, default=0.0)
    fpy_percent      = Column(Float, default=0.0)
    remarks          = Column(Text, nullable=True)
    created_by       = Column(GUID(), ForeignKey("users.id"), nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vendor = relationship("Vendor")
    floor_rel = relationship("VendorFloor")
    line_rel = relationship("VendorLine")
    rows = relationship("BatchAuditReportRow", back_populates="report", cascade="all, delete-orphan", order_by="BatchAuditReportRow.row_order")


class BatchAuditReportRow(Base):
    __tablename__ = "batch_audit_report_rows"

    id             = Column(GUID(), primary_key=True, default=uuid.uuid4)
    report_id      = Column(GUID(), ForeignKey("batch_audit_reports.id"), nullable=False, index=True)
    row_order      = Column(Integer, default=1)
    batch_number   = Column(String(100), nullable=True)
    batch_quantity = Column(Integer, default=0)
    sample_size    = Column(Integer, default=0)
    fault_counts   = Column(JSON, default={})
    total_faults   = Column(Integer, default=0)
    aql_accept     = Column(Integer, default=0)
    aql_reject     = Column(Integer, default=0)
    result         = Column(String(50), nullable=True)
    remarks        = Column(Text, nullable=True)

    report = relationship("BatchAuditReport", back_populates="rows")


# ─── INLINE QC REPORT ─────────────────────────────────────────────────────────

class InlineQCReport(Base):
    """
    Inline QC Report Header.
    Covers operation-wise, operator-wise hourly inspection at the line level.
    """
    __tablename__ = "inline_qc_reports"

    id              = Column(GUID(), primary_key=True, default=uuid.uuid4)
    vendor_id       = Column(GUID(), ForeignKey("vendors.id"), nullable=True)
    floor_id        = Column(GUID(), ForeignKey("vendor_floors.id"), nullable=True)
    floor           = Column(String(100), nullable=True) # Manual override if needed
    line_number     = Column(String(100), nullable=True)
    line_id         = Column(GUID(), ForeignKey("vendor_lines.id"), nullable=True)
    style_no        = Column(String(100), nullable=True)
    po_number       = Column(String(100), nullable=True)
    article_code    = Column(String(100), nullable=True)
    product_color   = Column(String(100), nullable=True)
    department      = Column(String(100), nullable=True)
    section         = Column(String(100), nullable=True)
    shift           = Column(String(50), nullable=True)
    qc_name         = Column(String(150), nullable=True)
    qc_code         = Column(String(50), nullable=True)
    inspection_level = Column(String(50), nullable=True)
    aql_standard    = Column(Float, default=2.5)
    table_number    = Column(String(50), nullable=True)
    inspection_date = Column(Date, default=date.today)

    # Summary Calculations (auto-computed)
    total_checked_pcs  = Column(Integer, default=0)
    total_defects      = Column(Integer, default=0)
    total_minor        = Column(Integer, default=0)
    total_major        = Column(Integer, default=0)
    total_critical     = Column(Integer, default=0)
    dhu_percent        = Column(Float, default=0.0)
    overall_pass_pct   = Column(Float, default=0.0)
    overall_reject_pct = Column(Float, default=0.0)

    # AQL
    aql_sample_size    = Column(Integer, default=0)
    aql_acceptance_qty = Column(Integer, default=0)
    aql_rejection_qty  = Column(Integer, default=0)
    aql_observed       = Column(Integer, default=0)
    aql_result         = Column(Enum(AQLResult), default=AQLResult.pending)

    # Meta
    remarks    = Column(Text, nullable=True)
    prepared_by = Column(String(150), nullable=True)
    checked_by  = Column(String(150), nullable=True)
    approved_by = Column(String(150), nullable=True)
    created_by  = Column(GUID(), ForeignKey("users.id"), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vendor = relationship("Vendor")
    floor_rel = relationship("VendorFloor")
    line = relationship("VendorLine")

    operations = relationship("InlineQCOperation", back_populates="report", cascade="all, delete-orphan", order_by="InlineQCOperation.op_order")
    traffic_history = relationship("OperatorTrafficLightHistory", back_populates="report", cascade="all, delete-orphan")


class InlineQCOperation(Base):
    """
    One row group = one operation (e.g. Shoulder Attached) with one operator.
    An operation can have multiple defects tracked across hours.
    """
    __tablename__ = "inline_qc_operations"

    id             = Column(GUID(), primary_key=True, default=uuid.uuid4)
    report_id      = Column(GUID(), ForeignKey("inline_qc_reports.id"), nullable=False, index=True)
    op_order       = Column(Integer, default=1)
    operation_name = Column(String(200), nullable=False)
    operator_name  = Column(String(150), nullable=True)

    # Computed per-operator totals
    total_checked  = Column(Integer, default=0)
    total_defects  = Column(Integer, default=0)
    dhu_percent    = Column(Float, default=0.0)
    traffic_status = Column(Enum(TrafficLightStatus), default=TrafficLightStatus.green)

    report = relationship("InlineQCReport", back_populates="operations")
    defect_rows = relationship("InlineQCDefectRow", back_populates="operation", cascade="all, delete-orphan")


class InlineQCDefectRow(Base):
    """
    Per-defect tracking row within an operation.
    Each row contains hourly data (stored as JSON array of {hour, checked, defects}).
    """
    __tablename__ = "inline_qc_defect_rows"

    id            = Column(GUID(), primary_key=True, default=uuid.uuid4)
    operation_id  = Column(GUID(), ForeignKey("inline_qc_operations.id"), nullable=False, index=True)
    defect_name   = Column(String(200), nullable=False)
    defect_id     = Column(String(50), nullable=True)
    severity      = Column(String(50), default="minor")  # minor | major | critical

    # Hourly data: [{hour: "09:00-10:00", checked: 20, defects: 2}, ...]
    hourly_data   = Column(JSON, default=[])

    total_checked = Column(Integer, default=0)
    total_defects = Column(Integer, default=0)
    dhu_percent   = Column(Float, default=0.0)

    operation = relationship("InlineQCOperation", back_populates="defect_rows")


class OperatorTrafficLightHistory(Base):
    """
    Immutable audit log for operator traffic light status changes.
    GREEN → YELLOW → RED (Yellow is mandatory before Red).
    """
    __tablename__ = "operator_traffic_light_history"

    id              = Column(GUID(), primary_key=True, default=uuid.uuid4)
    report_id       = Column(GUID(), ForeignKey("inline_qc_reports.id"), nullable=False, index=True)
    operator_name   = Column(String(150), nullable=False)
    operation_name  = Column(String(200), nullable=True)
    previous_status = Column(Enum(TrafficLightStatus), nullable=True)
    current_status  = Column(Enum(TrafficLightStatus), nullable=False)
    dhu_percent     = Column(Float, default=0.0)
    action_taken    = Column(String(300), nullable=True)
    remarks         = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    report = relationship("InlineQCReport", back_populates="traffic_history")


# ─── FINISH / ENDLINE QC REPORT ───────────────────────────────────────────────

class FinishEndlineQCReport(Base):
    """
    Finish QC or Endline QC Report Header.
    Supports dynamic defect columns with hourly data rows.
    """
    __tablename__ = "finish_endline_qc_reports"

    id               = Column(GUID(), primary_key=True, default=uuid.uuid4)
    report_type      = Column(Enum(FinishReportType), default=FinishReportType.finish)
    vendor_id        = Column(GUID(), ForeignKey("vendors.id"), nullable=True)
    floor_id         = Column(GUID(), ForeignKey("vendor_floors.id"), nullable=True)
    style_no         = Column(String(100), nullable=True)
    po_number        = Column(String(100), nullable=True)
    article_code     = Column(String(100), nullable=True)
    product_color    = Column(String(100), nullable=True)
    shift            = Column(String(50), nullable=True)
    line             = Column(String(100), nullable=True)
    line_id          = Column(GUID(), ForeignKey("vendor_lines.id"), nullable=True)
    qc_name          = Column(String(150), nullable=True)
    department       = Column(String(100), nullable=True)
    inspection_level = Column(String(50), nullable=True)
    report_date      = Column(Date, default=date.today)

    # AQL Fields
    aql_standard     = Column(Float, default=2.5)
    aql_sample_size  = Column(Integer, default=0)
    aql_acceptance   = Column(Integer, default=0)
    aql_rejection    = Column(Integer, default=0)
    aql_observed     = Column(Integer, default=0)
    aql_result       = Column(Enum(AQLResult), default=AQLResult.pending)

    # Day totals (auto-computed)
    total_pcs_inspected = Column(Integer, default=0)
    total_defects       = Column(Integer, default=0)
    dhu_percent         = Column(Float, default=0.0)

    # Defect column definitions (JSON array of {id, name, code})
    defect_columns   = Column(JSON, default=[])

    remarks    = Column(Text, nullable=True)
    prepared_by = Column(String(150), nullable=True)
    checked_by  = Column(String(150), nullable=True)
    created_by  = Column(GUID(), ForeignKey("users.id"), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vendor = relationship("Vendor")
    floor_rel = relationship("VendorFloor")
    line_rel = relationship("VendorLine")

    hourly_rows = relationship("FinishEndlineQCHourlyRow", back_populates="report", cascade="all, delete-orphan", order_by="FinishEndlineQCHourlyRow.row_order")


class FinishEndlineQCHourlyRow(Base):
    """
    One hourly time-slot row in the Finish/Endline report.
    Defect counts stored as JSON keyed by defect column name.
    """
    __tablename__ = "finish_endline_qc_hourly_rows"

    id            = Column(GUID(), primary_key=True, default=uuid.uuid4)
    report_id     = Column(GUID(), ForeignKey("finish_endline_qc_reports.id"), nullable=False, index=True)
    row_order     = Column(Integer, default=1)
    hour_slot     = Column(String(50), nullable=False)  # e.g. "09:00 - 10:00"
    total_pcs     = Column(Integer, default=0)
    
    # Defect counts: {defect_name: count, ...} keyed by defect column name
    defect_counts = Column(JSON, default={})
    
    # Auto-calculated
    total_defects = Column(Integer, default=0)
    dhu_percent   = Column(Float, default=0.0)

    report = relationship("FinishEndlineQCReport", back_populates="hourly_rows")
