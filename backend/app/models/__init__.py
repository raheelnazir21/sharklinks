"""
Shared imports for ALL models.
Alembic env.py imports this file so every table is discovered for migrations.
Add every new model file here as the project grows.
"""
# Step 1 — Auth & Users
from app.models.user import User, Role, RefreshToken, RoleEnum  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401

# Step 2 — Vendors, Orders, Production
from app.models.order import (  # noqa: F401
    Vendor, Order, ProductionStage, Attachment, OrderHistory,
    OrderStatus, OrderPriority, StageStatus, StageName,
)

# Step 3 — QC Reports
from app.models.qc_report import (  # noqa: F401
    DefectCode, QCReport, QCReportItem,
    QCReportType, ReportStatus, DefectSeverity,
)

# Step 4 — Advanced QC: Inline, Finish, Endline
from app.models.inline_qc import (  # noqa: F401
    InlineQCReport, InlineQCOperation, InlineQCDefectRow,
    OperatorTrafficLightHistory, FinishEndlineQCReport,
    FinishEndlineQCHourlyRow, CutPanelReport, CutPanelReportRow,
    BatchAuditReport, BatchAuditReportRow, TrafficLightStatus, AQLResult,
)
