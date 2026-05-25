"""
QC & QA Schemas — Pydantic shapes for the QC Reporting system.
Covers: Defect Master, Report Items (multi-defect), Attachments,
        Operator Flags, Article Codes, and Product Colors.
"""
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
from app.models.qc_report import QCReportType, ReportStatus, DefectSeverity, FlagColor


# ─── Defect Master ────────────────────────────────────────────────────────────

class DefectCategoryBase(BaseModel):
    report_type: QCReportType
    name: str
    status: bool = True

class DefectCategoryCreate(DefectCategoryBase):
    pass

class DefectCategoryOut(DefectCategoryBase):
    id: int
    class Config:
        from_attributes = True


class DefectCodeBase(BaseModel):
    report_type: QCReportType
    category_id: Optional[int] = None
    name: str
    code: str
    severity: DefectSeverity = DefectSeverity.major
    status: bool = True

class DefectCodeCreate(DefectCodeBase):
    pass

class DefectCodeOut(DefectCodeBase):
    id: int
    category_name: Optional[str] = None
    class Config:
        from_attributes = True


# ─── Multi-Defect Child Entry ─────────────────────────────────────────────────

class QCItemDefectEntry(BaseModel):
    """One defect within a row — used in the multi-defect chip list."""
    defect_id: int
    defect_count: int = 1
    severity: Optional[DefectSeverity] = None

class QCItemDefectEntryOut(QCItemDefectEntry):
    id: str
    defect_name: Optional[str] = None
    defect_code: Optional[str] = None
    class Config:
        from_attributes = True


# ─── Report Item ──────────────────────────────────────────────────────────────

class QCReportItemCreate(BaseModel):
    hour: Optional[str] = None
    batch_size: int = 0
    item_date: Optional[date] = None
    operation: Optional[str] = None
    corrective_action: Optional[str] = None
    remarks: Optional[str] = None
    # Multi-defect list (Track 1)
    defect_entries: List[QCItemDefectEntry] = []
    # Legacy single-defect (kept for backward compat)
    defect_id: Optional[int] = None
    defect_count: int = 0
    severity: Optional[DefectSeverity] = None
    # Operator context
    operator_number: Optional[str] = None
    operator_flag: Optional[str] = "green"

class QCReportItemOut(BaseModel):
    id: str
    hour: Optional[str] = None
    batch_size: int = 0
    item_date: Optional[date] = None
    operation: Optional[str] = None
    corrective_action: Optional[str] = None
    remarks: Optional[str] = None
    defect_entries: List[QCItemDefectEntryOut] = []
    # Legacy fields
    defect_id: Optional[int] = None
    defect_count: int = 0
    defect_name: Optional[str] = None
    defect_code: Optional[str] = None
    severity: Optional[DefectSeverity] = None
    operator_number: Optional[str] = None
    operator_flag: Optional[str] = None
    class Config:
        from_attributes = True


# ─── Attachment ───────────────────────────────────────────────────────────────

class QCReportAttachmentOut(BaseModel):
    id: str
    file_name: str
    mime_type: Optional[str] = None
    file_size: int = 0
    uploaded_at: datetime
    class Config:
        from_attributes = True


# ─── QC Report ────────────────────────────────────────────────────────────────

class QCReportCreate(BaseModel):
    report_type: QCReportType
    vendor_id: str
    floor_id: Optional[str] = None
    line_id: Optional[str] = None
    order_id: str

    auditor_id: Optional[str] = None
    auditor_name: Optional[str] = None
    auditor_code: Optional[str] = None

    inspection_date: date = date.today()
    shift: Optional[str] = None
    batch_number: Optional[str] = None
    stage: Optional[str] = None
    inspection_type: Optional[str] = None
    color: Optional[str] = None
    stm: Optional[str] = None

    quantity_checked: int = 0
    quantity_passed: int = 0
    quantity_rejected: int = 0

    remarks: Optional[str] = None
    items: List[QCReportItemCreate] = []

    # Track 3: Article & Color
    article_code_id: Optional[str] = None
    product_color_id: Optional[str] = None


class QCReportOut(BaseModel):
    id: str
    report_type: str
    vendor_name: Optional[str] = None
    floor_name: Optional[str] = None
    line_name: Optional[str] = None
    style_name: Optional[str] = None
    order_no: Optional[str] = None

    auditor_name: Optional[str] = None
    auditor_code: Optional[str] = None
    inspection_date: date
    shift: Optional[str] = None
    quantity_checked: int
    quantity_passed: int
    quantity_rejected: int
    total_defects: int

    dhu_percent: float
    fpy_percent: float
    pass_percent: float
    reject_percent: float

    critical_count: int
    major_count: int
    minor_count: int

    status: str
    remarks: Optional[str] = None
    items: List[QCReportItemOut] = []
    attachments: List[QCReportAttachmentOut] = []

    # Track 3
    article_code: Optional[str] = None
    article_code_name: Optional[str] = None
    product_color: Optional[str] = None

    created_at: datetime

    class Config:
        from_attributes = True


# ─── Analytics ────────────────────────────────────────────────────────────────

class AnalyticsSummary(BaseModel):
    total_inspections: int
    total_defects: int
    avg_dhu: float
    avg_fpy: float
    top_defects: List[dict]
    line_performance: List[dict]
    vendor_performance: List[dict]


# ─── Operator Flags (Track 2) ─────────────────────────────────────────────────

class OperatorFlagCreate(BaseModel):
    line_id: str
    operator_number: int
    operator_name: Optional[str] = None
    flag_color: FlagColor = FlagColor.green
    defect_id: Optional[int] = None
    note: Optional[str] = None
    corrective_action: Optional[str] = None

class OperatorFlagUpdate(BaseModel):
    operator_name: Optional[str] = None
    flag_color: Optional[FlagColor] = None
    defect_id: Optional[int] = None
    note: Optional[str] = None
    corrective_action: Optional[str] = None

class OperatorFlagHistoryOut(BaseModel):
    id: str
    old_color: Optional[str] = None
    new_color: str
    changed_at: datetime
    note: Optional[str] = None
    class Config:
        from_attributes = True

class OperatorFlagOut(BaseModel):
    id: str
    line_id: str
    operator_number: int
    operator_name: Optional[str] = None
    flag_color: str
    defect_id: Optional[int] = None
    defect_name: Optional[str] = None
    defect_code: Optional[str] = None
    note: Optional[str] = None
    corrective_action: Optional[str] = None
    flagged_at: datetime
    updated_at: datetime
    history: List[OperatorFlagHistoryOut] = []
    class Config:
        from_attributes = True


# ─── Article Code & Product Color (Track 3) ───────────────────────────────────

class ProductColorCreate(BaseModel):
    color_name: str
    color_hex: Optional[str] = None

class ProductColorOut(BaseModel):
    id: str
    article_id: str
    color_name: str
    color_hex: Optional[str] = None
    is_active: bool
    class Config:
        from_attributes = True

class ArticleCodeCreate(BaseModel):
    code: str
    name: Optional[str] = None
    product_name: Optional[str] = None
    track_type: str = "both"
    colors: List[ProductColorCreate] = []

class ArticleCodeUpdate(BaseModel):
    name: Optional[str] = None
    product_name: Optional[str] = None
    track_type: Optional[str] = None
    is_active: Optional[bool] = None

class ArticleCodeOut(BaseModel):
    id: str
    code: str
    name: Optional[str] = None
    product_name: Optional[str] = None
    track_type: str
    is_active: bool
    colors: List[ProductColorOut] = []
    class Config:
        from_attributes = True
