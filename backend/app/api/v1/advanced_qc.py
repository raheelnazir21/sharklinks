"""
API endpoints for Inline QC Reports, Finish QC Reports, and Endline QC Reports.
Supports full CRUD, DHU auto-calculation, AQL computation, and traffic light validation.
"""
import os
import uuid
from datetime import date
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, ConfigDict

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.inline_qc import (
    InlineQCReport, InlineQCOperation, InlineQCDefectRow,
    OperatorTrafficLightHistory, FinishEndlineQCReport,
    FinishEndlineQCHourlyRow, CutPanelReport, CutPanelReportRow,
    BatchAuditReport, BatchAuditReportRow,
    RandomInlineQCReport, RandomInlineQCProcessRow,
    TrafficLightStatus, AQLResult, FinishReportType
)
from app.models.qc_report import QCReportAttachment
from app.utils.response import success_response

router = APIRouter(prefix="/advanced-qc", tags=["Advanced QC"])

AllStaff = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager, RoleEnum.qc_officer])
AdvancedQCReadAccess = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager, RoleEnum.qc_officer, RoleEnum.viewer])


# ─── AQL TABLE (ISO 2859 simplified for 2.5 AQL) ──────────────────────────────
AQL_TABLE = {
    # sample_size: (acceptance, rejection)
    2: (0, 1), 3: (0, 1), 5: (0, 1), 8: (0, 1), 13: (0, 1),
    20: (1, 2), 32: (1, 2), 50: (2, 3), 80: (3, 4),
    125: (5, 6), 200: (7, 8), 315: (10, 11), 500: (14, 15)
}

def get_aql_sample_size(lot_size: int, aql: float = 2.5) -> int:
    """Return sample size based on lot size (General Inspection Level II)."""
    if lot_size <= 50: return 13
    if lot_size <= 90: return 20
    if lot_size <= 150: return 32
    if lot_size <= 280: return 50
    if lot_size <= 500: return 80
    if lot_size <= 1200: return 125
    if lot_size <= 3200: return 200
    return 315

def compute_aql(lot_size: int, observed_defects: int, aql: float = 2.5):
    sample_size = get_aql_sample_size(lot_size, aql)
    ac, re = AQL_TABLE.get(sample_size, (0, 1))
    result = AQLResult.pass_ if observed_defects <= ac else AQLResult.fail
    return sample_size, ac, re, result

def get_traffic_light(dhu: float) -> TrafficLightStatus:
    if dhu <= 3.0: return TrafficLightStatus.green
    if dhu <= 7.0: return TrafficLightStatus.yellow
    return TrafficLightStatus.red

def _delete_report_attachments(db: Session, report_id: str) -> None:
    attachments = db.query(QCReportAttachment).filter(QCReportAttachment.report_id == report_id).all()
    for attachment in attachments:
        if os.path.exists(attachment.file_path):
            os.remove(attachment.file_path)
        db.delete(attachment)


# ─── PYDANTIC SCHEMAS ─────────────────────────────────────────────────────────

class HourlyDataEntry(BaseModel):
    hour: str
    checked: int = 0
    defects: int = 0

class DefectRowIn(BaseModel):
    defect_name: str
    defect_id: Optional[str] = None
    severity: str = "minor"
    hourly_data: List[HourlyDataEntry] = []

class OperationIn(BaseModel):
    op_order: int = 1
    operation_name: str
    operator_name: Optional[str] = None
    defect_rows: List[DefectRowIn] = []

class InlineQCReportCreate(BaseModel):
    vendor_id: Optional[uuid.UUID] = None
    floor_id: Optional[uuid.UUID] = None
    line_id: Optional[uuid.UUID] = None
    floor: Optional[str] = None
    line_number: Optional[str] = None
    style_no: Optional[str] = None
    po_number: Optional[str] = None
    article_code: Optional[str] = None
    product_color: Optional[str] = None
    department: Optional[str] = None
    section: Optional[str] = None
    shift: Optional[str] = None
    qc_name: Optional[str] = None
    qc_code: Optional[str] = None
    inspection_level: Optional[str] = "II"
    aql_standard: float = 2.5
    table_number: Optional[str] = None
    inspection_date: Optional[date] = None
    remarks: Optional[str] = None
    prepared_by: Optional[str] = None
    checked_by: Optional[str] = None
    approved_by: Optional[str] = None
    operations: List[OperationIn] = []

class HourlyRowIn(BaseModel):
    hour_slot: str
    total_pcs: int = 0
    defect_counts: dict = {}

class FinishQCCreate(BaseModel):
    report_type: str = "finish"
    vendor_id: Optional[uuid.UUID] = None
    floor_id: Optional[uuid.UUID] = None
    line_id: Optional[uuid.UUID] = None
    style_no: Optional[str] = None
    po_number: Optional[str] = None
    article_code: Optional[str] = None
    product_color: Optional[str] = None
    shift: Optional[str] = None
    line: Optional[str] = None
    qc_name: Optional[str] = None
    department: Optional[str] = None
    inspection_level: Optional[str] = "II"
    report_date: Optional[date] = None
    aql_standard: float = 2.5
    defect_columns: List[dict] = []
    hourly_rows: List[HourlyRowIn] = []
    remarks: Optional[str] = None
    prepared_by: Optional[str] = None
    checked_by: Optional[str] = None

class CutPanelRowIn(BaseModel):
    bundle_number: Optional[str] = None
    size: Optional[str] = None
    pcs: int = 0
    defect_counts: dict = {}

class CutPanelReportCreate(BaseModel):
    vendor_id: Optional[uuid.UUID] = None
    floor_id: Optional[uuid.UUID] = None
    line_id: Optional[uuid.UUID] = None
    report_date: Optional[date] = None
    style_no: Optional[str] = None
    po_number: Optional[str] = None
    article_code: Optional[str] = None
    product_color: Optional[str] = None
    shift: Optional[str] = None
    qc_name: Optional[str] = None
    department: Optional[str] = "CUTTING"
    model_number: Optional[str] = None
    customer: Optional[str] = None
    stm: Optional[str] = None
    lot_number: Optional[str] = None
    lot_qty: int = 0
    defect_columns: List[dict] = []
    rows: List[CutPanelRowIn] = []
    remarks: Optional[str] = None
    quality_inspector: Optional[str] = None
    quality_supervisor: Optional[str] = None
    production_supervisor: Optional[str] = None

class BatchAuditRowIn(BaseModel):
    batch_number: Optional[str] = None
    batch_quantity: int = 0
    sample_size: int = 0
    fault_counts: dict = {}
    aql_accept: int = 0
    aql_reject: int = 0
    result: Optional[str] = None
    remarks: Optional[str] = None

class BatchAuditReportCreate(BaseModel):
    vendor_id: Optional[uuid.UUID] = None
    floor_id: Optional[uuid.UUID] = None
    line_id: Optional[uuid.UUID] = None
    report_date: Optional[date] = None
    issue_date: Optional[date] = None
    unit_number: Optional[str] = None
    stm: Optional[str] = None
    style_no: Optional[str] = None
    customer: Optional[str] = None
    product_name: Optional[str] = None
    product_color: Optional[str] = None
    auditor_number: Optional[str] = None
    shift: Optional[str] = None
    qc_name: Optional[str] = None
    department: Optional[str] = "FINISHING"
    inspection_level: Optional[str] = None
    aql_critical: Optional[str] = None
    aql_major: Optional[str] = None
    zero_tolerance: Optional[str] = None
    fault_library: List[dict] = []
    fault_columns: List[dict] = []
    rows: List[BatchAuditRowIn] = []
    first_pass_qty: int = 0
    second_pass_qty: int = 0
    remarks: Optional[str] = None


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def _serialize_inline_report(r: InlineQCReport) -> dict:
    ops_out = []
    for op in r.operations:
        rows_out = []
        for row in op.defect_rows:
            rows_out.append({
                "id": str(row.id),
                "defect_name": row.defect_name,
                "defect_id": row.defect_id,
                "severity": row.severity,
                "hourly_data": row.hourly_data or [],
                "total_checked": row.total_checked,
                "total_defects": row.total_defects,
                "dhu_percent": round(row.dhu_percent, 2),
            })
        ops_out.append({
            "id": str(op.id),
            "op_order": op.op_order,
            "operation_name": op.operation_name,
            "operator_name": op.operator_name,
            "total_checked": op.total_checked,
            "total_defects": op.total_defects,
            "dhu_percent": round(op.dhu_percent, 2),
            "traffic_status": op.traffic_status.value if op.traffic_status else "green",
            "defect_rows": rows_out,
        })

    # Top 5 defects
    defect_map: dict = {}
    for op in r.operations:
        for row in op.defect_rows:
            defect_map[row.defect_name] = defect_map.get(row.defect_name, 0) + row.total_defects
    top5 = sorted(defect_map.items(), key=lambda x: -x[1])[:5]
    top5_out = [{"rank": i+1, "name": k, "count": v, "pct": round((v/r.total_defects*100) if r.total_defects else 0, 2)} for i, (k, v) in enumerate(top5)]

    # Traffic history
    history = [{"date": str(h.created_at.date()), "operator": h.operator_name, "dhu": h.dhu_percent, "status": h.current_status.value, "action": h.action_taken or ""} for h in r.traffic_history]

    # Hourly summary
    hourly_map: dict = {}
    for op in r.operations:
        for row in op.defect_rows:
            for h in (row.hourly_data or []):
                slot = h.get("hour", "")
                if slot not in hourly_map:
                    hourly_map[slot] = {"checked": 0, "defects": 0}
                hourly_map[slot]["checked"] += h.get("checked", 0)
                hourly_map[slot]["defects"] += h.get("defects", 0)
    hourly_summary = [{"hour": k, "checked": v["checked"], "defects": v["defects"], "dhu": round((v["defects"]/v["checked"]*100) if v["checked"] else 0, 2)} for k, v in sorted(hourly_map.items())]

    return {
        "id": str(r.id),
        "vendor_id": str(r.vendor_id) if r.vendor_id else None,
        "floor_id": str(r.floor_id) if r.floor_id else None,
        "line_id": str(r.line_id) if r.line_id else None,
        "vendor_name": r.vendor.name if r.vendor else None,
        "floor_name": r.floor_rel.name if r.floor_rel else r.floor,
        "line_name": r.line.name if r.line else r.line_number,
        "floor": r.floor,
        "line_number": r.line_number,
        "style_no": r.style_no,
        "po_number": r.po_number,
        "article_code": r.article_code,
        "product_color": r.product_color,
        "department": r.department,
        "section": r.section,
        "shift": r.shift,
        "qc_name": r.qc_name,
        "qc_code": r.qc_code,
        "inspection_level": r.inspection_level,
        "aql_standard": r.aql_standard,
        "table_number": r.table_number,
        "inspection_date": str(r.inspection_date) if r.inspection_date else None,
        "total_checked_pcs": r.total_checked_pcs,
        "total_defects": r.total_defects,
        "total_minor": r.total_minor,
        "total_major": r.total_major,
        "total_critical": r.total_critical,
        "dhu_percent": round(r.dhu_percent, 2),
        "overall_pass_pct": round(r.overall_pass_pct, 2),
        "overall_reject_pct": round(r.overall_reject_pct, 2),
        "aql_standard": r.aql_standard,
        "aql_sample_size": r.aql_sample_size,
        "aql_acceptance_qty": r.aql_acceptance_qty,
        "aql_rejection_qty": r.aql_rejection_qty,
        "aql_observed": r.aql_observed,
        "aql_result": r.aql_result.value if r.aql_result else "pending",
        "remarks": r.remarks,
        "prepared_by": r.prepared_by,
        "checked_by": r.checked_by,
        "approved_by": r.approved_by,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "operations": ops_out,
        "top_defects": top5_out,
        "traffic_history": history,
        "hourly_summary": hourly_summary,
    }

def _serialize_finish_report(r: FinishEndlineQCReport) -> dict:
    rows_out = []
    for row in r.hourly_rows:
        rows_out.append({
            "id": str(row.id),
            "row_order": row.row_order,
            "hour_slot": row.hour_slot,
            "total_pcs": row.total_pcs,
            "defect_counts": row.defect_counts or {},
            "total_defects": row.total_defects,
            "dhu_percent": round(row.dhu_percent, 2),
        })

    # Top defects from all rows
    defect_totals: dict = {}
    for row in r.hourly_rows:
        for k, v in (row.defect_counts or {}).items():
            defect_totals[k] = defect_totals.get(k, 0) + v
    top5 = sorted(defect_totals.items(), key=lambda x: -x[1])[:5]
    top5_out = [{"rank": i+1, "name": k, "count": v, "pct": round((v/r.total_defects*100) if r.total_defects else 0, 2)} for i, (k, v) in enumerate(top5)]

    return {
        "id": str(r.id),
        "report_type": r.report_type.value if r.report_type else "finish",
        "vendor_id": str(r.vendor_id) if r.vendor_id else None,
        "floor_id": str(r.floor_id) if r.floor_id else None,
        "line_id": str(r.line_id) if r.line_id else None,
        "vendor_name": r.vendor.name if r.vendor else None,
        "floor_name": r.floor_rel.name if r.floor_rel else None,
        "line_name": r.line_rel.name if r.line_rel else r.line,
        "style_no": r.style_no,
        "po_number": r.po_number,
        "article_code": r.article_code,
        "product_color": r.product_color,
        "shift": r.shift,
        "line": r.line,
        "qc_name": r.qc_name,
        "department": r.department,
        "inspection_level": r.inspection_level,
        "report_date": str(r.report_date) if r.report_date else None,
        "aql_standard": r.aql_standard,
        "aql_sample_size": r.aql_sample_size,
        "aql_acceptance": r.aql_acceptance,
        "aql_rejection": r.aql_rejection,
        "aql_observed": r.aql_observed,
        "aql_result": r.aql_result.value if r.aql_result else "pending",
        "total_pcs_inspected": r.total_pcs_inspected,
        "total_defects": r.total_defects,
        "dhu_percent": round(r.dhu_percent, 2),
        "defect_columns": r.defect_columns or [],
        "remarks": r.remarks,
        "prepared_by": r.prepared_by,
        "checked_by": r.checked_by,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "hourly_rows": rows_out,
        "top_defects": top5_out,
        "defect_totals": defect_totals,
    }


def _serialize_cut_panel_report(r: CutPanelReport) -> dict:
    rows_out = []
    defect_totals: dict = {}
    for row in r.rows:
        counts = row.defect_counts or {}
        for key, value in counts.items():
            defect_totals[key] = defect_totals.get(key, 0) + int(value or 0)
        rows_out.append({
            "id": str(row.id),
            "row_order": row.row_order,
            "bundle_number": row.bundle_number,
            "size": row.size,
            "pcs": row.pcs,
            "defect_counts": counts,
            "total_defects": row.total_defects,
            "defect_percent": round(row.defect_percent or 0, 2),
        })

    return {
        "id": str(r.id),
        "report_type": "cut_panel",
        "vendor_id": str(r.vendor_id) if r.vendor_id else None,
        "floor_id": str(r.floor_id) if r.floor_id else None,
        "line_id": str(r.line_id) if r.line_id else None,
        "vendor_name": r.vendor.name if r.vendor else None,
        "floor_name": r.floor_rel.name if r.floor_rel else None,
        "line_name": r.line_rel.name if r.line_rel else None,
        "report_date": str(r.report_date) if r.report_date else None,
        "style_no": r.style_no,
        "po_number": r.po_number,
        "article_code": r.article_code,
        "product_color": r.product_color,
        "shift": r.shift,
        "qc_name": r.qc_name,
        "department": r.department,
        "model_number": r.model_number,
        "customer": r.customer,
        "stm": r.stm,
        "lot_number": r.lot_number,
        "lot_qty": r.lot_qty,
        "total_checked": r.total_checked,
        "total_defects": r.total_defects,
        "defect_percent": round(r.defect_percent or 0, 2),
        "defect_columns": r.defect_columns or [],
        "defect_totals": defect_totals,
        "remarks": r.remarks,
        "quality_inspector": r.quality_inspector,
        "quality_supervisor": r.quality_supervisor,
        "production_supervisor": r.production_supervisor,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "rows": rows_out,
    }


def _serialize_batch_audit_report(r: BatchAuditReport) -> dict:
    rows_out = []
    fault_totals: dict = {}
    for row in r.rows:
        counts = row.fault_counts or {}
        for key, value in counts.items():
            fault_totals[key] = fault_totals.get(key, 0) + int(value or 0)
        rows_out.append({
            "id": str(row.id),
            "row_order": row.row_order,
            "batch_number": row.batch_number,
            "batch_quantity": row.batch_quantity,
            "sample_size": row.sample_size,
            "fault_counts": counts,
            "total_faults": row.total_faults,
            "aql_accept": row.aql_accept,
            "aql_reject": row.aql_reject,
            "result": row.result,
            "remarks": row.remarks,
        })

    return {
        "id": str(r.id),
        "report_type": "batch_audit",
        "vendor_id": str(r.vendor_id) if r.vendor_id else None,
        "floor_id": str(r.floor_id) if r.floor_id else None,
        "line_id": str(r.line_id) if r.line_id else None,
        "vendor_name": r.vendor.name if r.vendor else None,
        "floor_name": r.floor_rel.name if r.floor_rel else None,
        "line_name": r.line_rel.name if r.line_rel else None,
        "report_date": str(r.report_date) if r.report_date else None,
        "issue_date": str(r.issue_date) if r.issue_date else None,
        "unit_number": r.unit_number,
        "stm": r.stm,
        "style_no": r.style_no,
        "customer": r.customer,
        "product_name": r.product_name,
        "product_color": r.product_color,
        "auditor_number": r.auditor_number,
        "shift": r.shift,
        "qc_name": r.qc_name,
        "department": r.department,
        "inspection_level": r.inspection_level,
        "aql_critical": r.aql_critical,
        "aql_major": r.aql_major,
        "zero_tolerance": r.zero_tolerance,
        "fault_library": r.fault_library or [],
        "fault_columns": r.fault_columns or [],
        "fault_totals": fault_totals,
        "total_quantity": r.total_quantity,
        "total_sample_qty": r.total_sample_qty,
        "total_faults": r.total_faults,
        "first_pass_qty": r.first_pass_qty,
        "second_pass_qty": r.second_pass_qty,
        "oqi_percent": round(r.oqi_percent or 0, 2),
        "fpy_percent": round(r.fpy_percent or 0, 2),
        "remarks": r.remarks,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "rows": rows_out,
    }


# ─── INLINE QC ENDPOINTS ──────────────────────────────────────────────────────

@router.get("/inline/", summary="List Inline QC Reports")
def list_inline_reports(skip: int = 0, limit: int = 50, db: Session = Depends(get_db), current_user: User = Depends(AdvancedQCReadAccess)):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin", "viewer")

    q = db.query(InlineQCReport).options(
        joinedload(InlineQCReport.vendor),
        joinedload(InlineQCReport.floor_rel),
        joinedload(InlineQCReport.line)
    )
    if not is_admin:
        q = q.filter(InlineQCReport.created_by == current_user.id)
    reports = q.order_by(InlineQCReport.created_at.desc()).offset(skip).limit(limit).all()
    return success_response(data=[_serialize_inline_report(r) for r in reports])

@router.get("/inline/{report_id}", summary="Get Inline QC Report Detail")
def get_inline_report(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(AdvancedQCReadAccess)):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin", "viewer")

    r = db.query(InlineQCReport).options(
        joinedload(InlineQCReport.vendor),
        joinedload(InlineQCReport.floor_rel),
        joinedload(InlineQCReport.line),
        joinedload(InlineQCReport.operations).joinedload(InlineQCOperation.defect_rows),
        joinedload(InlineQCReport.traffic_history)
    ).filter(InlineQCReport.id == report_id).first()
    if not r:
        raise HTTPException(404, "Inline QC report not found.")
    if not is_admin and str(r.created_by) != str(current_user.id):
        raise HTTPException(403, "You do not have permission to access this report.")
    return success_response(data=_serialize_inline_report(r))

@router.post("/inline/", summary="Create Inline QC Report")
def create_inline_report(payload: InlineQCReportCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(AllStaff)):
    report = InlineQCReport(
        id=uuid.uuid4(),
        vendor_id=payload.vendor_id, floor_id=payload.floor_id,
        line_id=payload.line_id,
        floor=payload.floor, line_number=payload.line_number,
        style_no=payload.style_no, po_number=payload.po_number,
        article_code=payload.article_code, product_color=payload.product_color,
        department=payload.department, section=payload.section,
        shift=payload.shift, qc_name=payload.qc_name, qc_code=payload.qc_code,
        inspection_level=payload.inspection_level, aql_standard=payload.aql_standard,
        table_number=payload.table_number,
        inspection_date=payload.inspection_date or date.today(),
        remarks=payload.remarks, prepared_by=payload.prepared_by,
        checked_by=payload.checked_by, approved_by=payload.approved_by,
        created_by=current_user.id,
    )
    db.add(report)
    db.flush()

    total_checked = 0; total_defects = 0; total_minor = 0; total_major = 0; total_critical = 0

    for op_in in payload.operations:
        op = InlineQCOperation(
            id=uuid.uuid4(), report_id=report.id,
            op_order=op_in.op_order, operation_name=op_in.operation_name,
            operator_name=op_in.operator_name,
        )
        db.add(op); db.flush()

        op_checked = 0; op_defects = 0

        for row_in in op_in.defect_rows:
            row_checked = sum(h.checked for h in row_in.hourly_data)
            row_defects = sum(h.defects for h in row_in.hourly_data)
            row_dhu = (row_defects / row_checked * 100) if row_checked else 0

            defect_row = InlineQCDefectRow(
                id=uuid.uuid4(), operation_id=op.id,
                defect_name=row_in.defect_name, defect_id=row_in.defect_id,
                severity=row_in.severity,
                hourly_data=[h.model_dump() for h in row_in.hourly_data],
                total_checked=row_checked, total_defects=row_defects,
                dhu_percent=row_dhu,
            )
            db.add(defect_row)

            op_checked = max(op_checked, row_checked)
            op_defects += row_defects

            sev = row_in.severity.lower()
            if sev == "minor": total_minor += row_defects
            elif sev == "major": total_major += row_defects
            elif sev == "critical": total_critical += row_defects
            total_defects += row_defects

        op.total_checked = op_checked
        op.total_defects = op_defects
        op.dhu_percent = (op_defects / op_checked * 100) if op_checked else 0
        op.traffic_status = get_traffic_light(op.dhu_percent)
        total_checked += op_checked

    # Aggregate report
    report.total_checked_pcs = total_checked
    report.total_defects = total_defects
    report.total_minor = total_minor
    report.total_major = total_major
    report.total_critical = total_critical
    report.dhu_percent = (total_defects / total_checked * 100) if total_checked else 0
    report.overall_reject_pct = report.dhu_percent
    report.overall_pass_pct = max(0, 100 - report.dhu_percent)

    # AQL
    s, ac, re, aql_res = compute_aql(total_checked, total_defects, payload.aql_standard)
    report.aql_sample_size = s; report.aql_acceptance_qty = ac
    report.aql_rejection_qty = re; report.aql_observed = total_defects
    report.aql_result = aql_res

    db.commit(); db.refresh(report)
    return success_response(data=_serialize_inline_report(report), message="Inline QC report created.")


@router.put("/inline/{report_id}", summary="Update Inline QC Report")
def update_inline_report(report_id: str, payload: InlineQCReportCreate, db: Session = Depends(get_db), current_user: User = Depends(AllStaff)):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin")

    report = db.query(InlineQCReport).options(
        joinedload(InlineQCReport.operations).joinedload(InlineQCOperation.defect_rows),
    ).filter(InlineQCReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Inline QC report not found.")
    if not is_admin and str(report.created_by) != str(current_user.id):
        raise HTTPException(403, "You do not have permission to edit this report.")

    # Update header fields
    for field in ["vendor_id","floor_id","line_id","floor","line_number","style_no","po_number",
                  "article_code","product_color","department","section","shift","qc_name","qc_code",
                  "inspection_level","aql_standard","table_number","remarks","prepared_by","checked_by","approved_by"]:
        val = getattr(payload, field, None)
        if val is not None:
            setattr(report, field, val)
    if payload.inspection_date:
        report.inspection_date = payload.inspection_date

    # Delete old operations & defect rows (cascade)
    for op in report.operations:
        db.delete(op)
    db.flush()

    total_checked = 0; total_defects = 0; total_minor = 0; total_major = 0; total_critical = 0

    for op_in in payload.operations:
        op = InlineQCOperation(
            id=uuid.uuid4(), report_id=report.id,
            op_order=op_in.op_order, operation_name=op_in.operation_name,
            operator_name=op_in.operator_name,
        )
        db.add(op); db.flush()

        op_checked = 0; op_defects = 0

        for row_in in op_in.defect_rows:
            row_checked = sum(h.checked for h in row_in.hourly_data)
            row_defects = sum(h.defects for h in row_in.hourly_data)
            row_dhu = (row_defects / row_checked * 100) if row_checked else 0

            defect_row = InlineQCDefectRow(
                id=uuid.uuid4(), operation_id=op.id,
                defect_name=row_in.defect_name, defect_id=row_in.defect_id,
                severity=row_in.severity,
                hourly_data=[h.model_dump() for h in row_in.hourly_data],
                total_checked=row_checked, total_defects=row_defects,
                dhu_percent=row_dhu,
            )
            db.add(defect_row)

            op_checked = max(op_checked, row_checked)
            op_defects += row_defects

            sev = row_in.severity.lower()
            if sev == "minor": total_minor += row_defects
            elif sev == "major": total_major += row_defects
            elif sev == "critical": total_critical += row_defects
            total_defects += row_defects

        op.total_checked = op_checked
        op.total_defects = op_defects
        op.dhu_percent = (op_defects / op_checked * 100) if op_checked else 0
        op.traffic_status = get_traffic_light(op.dhu_percent)
        total_checked += op_checked

    report.total_checked_pcs = total_checked
    report.total_defects = total_defects
    report.total_minor = total_minor
    report.total_major = total_major
    report.total_critical = total_critical
    report.dhu_percent = (total_defects / total_checked * 100) if total_checked else 0
    report.overall_reject_pct = report.dhu_percent
    report.overall_pass_pct = max(0, 100 - report.dhu_percent)

    s, ac, re, aql_res = compute_aql(total_checked, total_defects, payload.aql_standard)
    report.aql_sample_size = s; report.aql_acceptance_qty = ac
    report.aql_rejection_qty = re; report.aql_observed = total_defects
    report.aql_result = aql_res

    db.commit(); db.refresh(report)
    return success_response(data=_serialize_inline_report(report), message="Inline QC report updated.")


@router.delete("/inline/{report_id}", summary="Delete Inline QC Report")
def delete_inline_report(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(AllStaff)):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin")

    report = db.query(InlineQCReport).filter(InlineQCReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Inline QC report not found.")
    if not is_admin and str(report.created_by) != str(current_user.id):
        raise HTTPException(403, "You do not have permission to delete this report.")

    _delete_report_attachments(db, report_id)
    db.delete(report)
    db.commit()
    return success_response(message="Inline QC report deleted.")


# ─── CUT PANEL QC ENDPOINTS ──────────────────────────────────────────────────

@router.get("/cut-panel/", summary="List Cut Panel Reports")
def list_cut_panel_reports(skip: int = 0, limit: int = 50, db: Session = Depends(get_db), current_user: User = Depends(AdvancedQCReadAccess)):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin", "viewer")

    q = db.query(CutPanelReport).options(
        joinedload(CutPanelReport.vendor),
        joinedload(CutPanelReport.floor_rel),
        joinedload(CutPanelReport.line_rel),
        joinedload(CutPanelReport.rows),
    )
    if not is_admin:
        q = q.filter(CutPanelReport.created_by == current_user.id)
    reports = q.order_by(CutPanelReport.created_at.desc()).offset(skip).limit(limit).all()
    return success_response(data=[_serialize_cut_panel_report(r) for r in reports])


@router.get("/cut-panel/{report_id}", summary="Get Cut Panel Report")
def get_cut_panel_report(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(AdvancedQCReadAccess)):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin", "viewer")

    report = db.query(CutPanelReport).options(
        joinedload(CutPanelReport.vendor),
        joinedload(CutPanelReport.floor_rel),
        joinedload(CutPanelReport.line_rel),
        joinedload(CutPanelReport.rows),
    ).filter(CutPanelReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Cut panel report not found.")
    if not is_admin and str(report.created_by) != str(current_user.id):
        raise HTTPException(403, "You do not have permission to access this report.")
    return success_response(data=_serialize_cut_panel_report(report))


@router.post("/cut-panel/", summary="Create Cut Panel Report")
def create_cut_panel_report(payload: CutPanelReportCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(AllStaff)):
    report = CutPanelReport(
        id=uuid.uuid4(),
        vendor_id=payload.vendor_id,
        floor_id=payload.floor_id,
        line_id=payload.line_id,
        report_date=payload.report_date or date.today(),
        style_no=payload.style_no,
        po_number=payload.po_number,
        article_code=payload.article_code,
        product_color=payload.product_color,
        shift=payload.shift,
        qc_name=payload.qc_name,
        department=payload.department or "CUTTING",
        model_number=payload.model_number,
        customer=payload.customer,
        stm=payload.stm,
        lot_number=payload.lot_number,
        lot_qty=payload.lot_qty,
        defect_columns=payload.defect_columns,
        remarks=payload.remarks,
        quality_inspector=payload.quality_inspector,
        quality_supervisor=payload.quality_supervisor,
        production_supervisor=payload.production_supervisor,
        created_by=current_user.id,
    )
    db.add(report)
    db.flush()

    total_checked = 0
    total_defects = 0
    for index, row_in in enumerate(payload.rows):
        row_defects = sum(int(value or 0) for value in row_in.defect_counts.values())
        row_percent = (row_defects / row_in.pcs * 100) if row_in.pcs else 0
        row = CutPanelReportRow(
            id=uuid.uuid4(),
            report_id=report.id,
            row_order=index + 1,
            bundle_number=row_in.bundle_number,
            size=row_in.size,
            pcs=row_in.pcs,
            defect_counts=row_in.defect_counts,
            total_defects=row_defects,
            defect_percent=row_percent,
        )
        db.add(row)
        total_checked += row_in.pcs
        total_defects += row_defects

    report.total_checked = total_checked
    report.total_defects = total_defects
    report.defect_percent = (total_defects / total_checked * 100) if total_checked else 0

    db.commit()
    db.refresh(report)
    return success_response(data=_serialize_cut_panel_report(report), message="Cut panel report created.")


@router.put("/cut-panel/{report_id}", summary="Update Cut Panel Report")
def update_cut_panel_report(report_id: str, payload: CutPanelReportCreate, db: Session = Depends(get_db), current_user: User = Depends(AllStaff)):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin")

    report = db.query(CutPanelReport).filter(CutPanelReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Cut panel report not found.")
    if not is_admin and str(report.created_by) != str(current_user.id):
        raise HTTPException(403, "You do not have permission to edit this report.")

    for field in ["vendor_id","floor_id","line_id","style_no","po_number","article_code","product_color",
                  "shift","qc_name","department","model_number","customer","stm","lot_number","lot_qty",
                  "remarks","quality_inspector","quality_supervisor","production_supervisor"]:
        val = getattr(payload, field, None)
        if val is not None:
            setattr(report, field, val)
    if payload.report_date:
        report.report_date = payload.report_date
    report.defect_columns = payload.defect_columns

    # Delete old rows and recreate
    db.query(CutPanelReportRow).filter(CutPanelReportRow.report_id == report_id).delete()

    total_checked = 0
    total_defects = 0
    for index, row_in in enumerate(payload.rows):
        row_defects = sum(int(value or 0) for value in row_in.defect_counts.values())
        row_percent = (row_defects / row_in.pcs * 100) if row_in.pcs else 0
        row = CutPanelReportRow(
            id=uuid.uuid4(),
            report_id=report.id,
            row_order=index + 1,
            bundle_number=row_in.bundle_number,
            size=row_in.size,
            pcs=row_in.pcs,
            defect_counts=row_in.defect_counts,
            total_defects=row_defects,
            defect_percent=row_percent,
        )
        db.add(row)
        total_checked += row_in.pcs
        total_defects += row_defects

    report.total_checked = total_checked
    report.total_defects = total_defects
    report.defect_percent = (total_defects / total_checked * 100) if total_checked else 0

    db.commit()
    db.refresh(report)
    return success_response(data=_serialize_cut_panel_report(report), message="Cut panel report updated.")


@router.delete("/cut-panel/{report_id}", summary="Delete Cut Panel Report")
def delete_cut_panel_report(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(AllStaff)):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin")

    report = db.query(CutPanelReport).filter(CutPanelReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Cut panel report not found.")
    if not is_admin and str(report.created_by) != str(current_user.id):
        raise HTTPException(403, "You do not have permission to delete this report.")

    _delete_report_attachments(db, report_id)
    db.delete(report)
    db.commit()
    return success_response(message="Cut panel report deleted.")


# ─── BATCH AUDIT ENDPOINTS ───────────────────────────────────────────────────

@router.get("/batch-audit/", summary="List Batch Audit Reports")
def list_batch_audit_reports(skip: int = 0, limit: int = 50, db: Session = Depends(get_db), current_user: User = Depends(AdvancedQCReadAccess)):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin", "viewer")

    q = db.query(BatchAuditReport).options(
        joinedload(BatchAuditReport.vendor),
        joinedload(BatchAuditReport.floor_rel),
        joinedload(BatchAuditReport.line_rel),
        joinedload(BatchAuditReport.rows),
    )
    if not is_admin:
        q = q.filter(BatchAuditReport.created_by == current_user.id)
    reports = q.order_by(BatchAuditReport.created_at.desc()).offset(skip).limit(limit).all()
    return success_response(data=[_serialize_batch_audit_report(r) for r in reports])


@router.get("/batch-audit/{report_id}", summary="Get Batch Audit Report")
def get_batch_audit_report(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(AdvancedQCReadAccess)):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin", "viewer")

    report = db.query(BatchAuditReport).options(
        joinedload(BatchAuditReport.vendor),
        joinedload(BatchAuditReport.floor_rel),
        joinedload(BatchAuditReport.line_rel),
        joinedload(BatchAuditReport.rows),
    ).filter(BatchAuditReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Batch audit report not found.")
    if not is_admin and str(report.created_by) != str(current_user.id):
        raise HTTPException(403, "You do not have permission to access this report.")
    return success_response(data=_serialize_batch_audit_report(report))


@router.post("/batch-audit/", summary="Create Batch Audit Report")
def create_batch_audit_report(payload: BatchAuditReportCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(AllStaff)):
    report = BatchAuditReport(
        id=uuid.uuid4(),
        vendor_id=payload.vendor_id,
        floor_id=payload.floor_id,
        line_id=payload.line_id,
        report_date=payload.report_date or date.today(),
        issue_date=payload.issue_date,
        unit_number=payload.unit_number,
        stm=payload.stm,
        style_no=payload.style_no,
        customer=payload.customer,
        product_name=payload.product_name,
        product_color=payload.product_color,
        auditor_number=payload.auditor_number,
        shift=payload.shift,
        qc_name=payload.qc_name,
        department=payload.department or "FINISHING",
        inspection_level=payload.inspection_level,
        aql_critical=payload.aql_critical,
        aql_major=payload.aql_major,
        zero_tolerance=payload.zero_tolerance,
        fault_library=payload.fault_library,
        fault_columns=payload.fault_columns,
        first_pass_qty=payload.first_pass_qty,
        second_pass_qty=payload.second_pass_qty,
        remarks=payload.remarks,
        created_by=current_user.id,
    )
    db.add(report)
    db.flush()

    total_quantity = 0
    total_sample_qty = 0
    total_faults = 0
    for index, row_in in enumerate(payload.rows):
        row_faults = sum(int(value or 0) for value in row_in.fault_counts.values())
        row = BatchAuditReportRow(
            id=uuid.uuid4(),
            report_id=report.id,
            row_order=index + 1,
            batch_number=row_in.batch_number,
            batch_quantity=row_in.batch_quantity,
            sample_size=row_in.sample_size,
            fault_counts=row_in.fault_counts,
            total_faults=row_faults,
            aql_accept=row_in.aql_accept,
            aql_reject=row_in.aql_reject,
            result=row_in.result,
            remarks=row_in.remarks,
        )
        db.add(row)
        total_quantity += row_in.batch_quantity
        total_sample_qty += row_in.sample_size
        total_faults += row_faults

    report.total_quantity = total_quantity
    report.total_sample_qty = total_sample_qty
    report.total_faults = total_faults
    report.oqi_percent = (total_faults / total_sample_qty * 100) if total_sample_qty else 0
    report.fpy_percent = (payload.first_pass_qty / total_quantity * 100) if total_quantity else 0

    db.commit()
    db.refresh(report)
    return success_response(data=_serialize_batch_audit_report(report), message="Batch audit report created.")


@router.put("/batch-audit/{report_id}", summary="Update Batch Audit Report")
def update_batch_audit_report(report_id: str, payload: BatchAuditReportCreate, db: Session = Depends(get_db), current_user: User = Depends(AllStaff)):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin")

    report = db.query(BatchAuditReport).filter(BatchAuditReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Batch audit report not found.")
    if not is_admin and str(report.created_by) != str(current_user.id):
        raise HTTPException(403, "You do not have permission to edit this report.")

    for field in ["vendor_id","floor_id","line_id","unit_number","stm","style_no","customer",
                  "product_name","product_color","auditor_number","shift","qc_name","department",
                  "inspection_level","aql_critical","aql_major","zero_tolerance","remarks"]:
        val = getattr(payload, field, None)
        if val is not None:
            setattr(report, field, val)
    if payload.report_date:
        report.report_date = payload.report_date
    if payload.issue_date:
        report.issue_date = payload.issue_date
    report.fault_library = payload.fault_library
    report.fault_columns = payload.fault_columns
    report.first_pass_qty = payload.first_pass_qty
    report.second_pass_qty = payload.second_pass_qty

    # Delete old rows and recreate
    db.query(BatchAuditReportRow).filter(BatchAuditReportRow.report_id == report_id).delete()

    total_quantity = 0
    total_sample_qty = 0
    total_faults = 0
    for index, row_in in enumerate(payload.rows):
        row_faults = sum(int(value or 0) for value in row_in.fault_counts.values())
        row = BatchAuditReportRow(
            id=uuid.uuid4(),
            report_id=report.id,
            row_order=index + 1,
            batch_number=row_in.batch_number,
            batch_quantity=row_in.batch_quantity,
            sample_size=row_in.sample_size,
            fault_counts=row_in.fault_counts,
            total_faults=row_faults,
            aql_accept=row_in.aql_accept,
            aql_reject=row_in.aql_reject,
            result=row_in.result,
            remarks=row_in.remarks,
        )
        db.add(row)
        total_quantity += row_in.batch_quantity
        total_sample_qty += row_in.sample_size
        total_faults += row_faults

    report.total_quantity = total_quantity
    report.total_sample_qty = total_sample_qty
    report.total_faults = total_faults
    report.oqi_percent = (total_faults / total_sample_qty * 100) if total_sample_qty else 0
    report.fpy_percent = (payload.first_pass_qty / total_quantity * 100) if total_quantity else 0

    db.commit()
    db.refresh(report)
    return success_response(data=_serialize_batch_audit_report(report), message="Batch audit report updated.")


@router.delete("/batch-audit/{report_id}", summary="Delete Batch Audit Report")
def delete_batch_audit_report(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(AllStaff)):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin")

    report = db.query(BatchAuditReport).filter(BatchAuditReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Batch audit report not found.")
    if not is_admin and str(report.created_by) != str(current_user.id):
        raise HTTPException(403, "You do not have permission to delete this report.")

    _delete_report_attachments(db, report_id)
    db.delete(report)
    db.commit()
    return success_response(message="Batch audit report deleted.")


# ─── FINISH / ENDLINE QC ENDPOINTS ───────────────────────────────────────────

@router.get("/finish-endline/", summary="List Finish/Endline QC Reports")
def list_finish_reports(report_type: Optional[str] = None, skip: int = 0, limit: int = 50, db: Session = Depends(get_db), current_user: User = Depends(AdvancedQCReadAccess)):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin", "viewer")

    q = db.query(FinishEndlineQCReport).options(
        joinedload(FinishEndlineQCReport.vendor),
        joinedload(FinishEndlineQCReport.floor_rel),
        joinedload(FinishEndlineQCReport.line_rel)
    )
    if report_type:
        q = q.filter(FinishEndlineQCReport.report_type == report_type)
    if not is_admin:
        q = q.filter(FinishEndlineQCReport.created_by == current_user.id)
    reports = q.order_by(FinishEndlineQCReport.created_at.desc()).offset(skip).limit(limit).all()
    return success_response(data=[_serialize_finish_report(r) for r in reports])

@router.get("/finish-endline/{report_id}", summary="Get Finish/Endline QC Report")
def get_finish_report(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(AdvancedQCReadAccess)):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin", "viewer")

    r = db.query(FinishEndlineQCReport).options(
        joinedload(FinishEndlineQCReport.vendor),
        joinedload(FinishEndlineQCReport.floor_rel),
        joinedload(FinishEndlineQCReport.line_rel),
        joinedload(FinishEndlineQCReport.hourly_rows)
    ).filter(FinishEndlineQCReport.id == report_id).first()
    if not r:
        raise HTTPException(404, "Report not found.")
    if not is_admin and str(r.created_by) != str(current_user.id):
        raise HTTPException(403, "You do not have permission to access this report.")
    return success_response(data=_serialize_finish_report(r))

@router.post("/finish-endline/", summary="Create Finish/Endline QC Report")
def create_finish_report(payload: FinishQCCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(AllStaff)):
    rtype = FinishReportType.endline if payload.report_type == "endline" else FinishReportType.finish
    report = FinishEndlineQCReport(
        id=uuid.uuid4(), report_type=rtype,
        vendor_id=payload.vendor_id, floor_id=payload.floor_id,
        line_id=payload.line_id,
        style_no=payload.style_no, po_number=payload.po_number,
        article_code=payload.article_code, product_color=payload.product_color,
        shift=payload.shift, line=payload.line, qc_name=payload.qc_name,
        department=payload.department, inspection_level=payload.inspection_level,
        report_date=payload.report_date or date.today(),
        aql_standard=payload.aql_standard,
        defect_columns=payload.defect_columns,
        remarks=payload.remarks, prepared_by=payload.prepared_by,
        checked_by=payload.checked_by, created_by=current_user.id,
    )
    db.add(report); db.flush()

    grand_pcs = 0; grand_defects = 0

    for i, row_in in enumerate(payload.hourly_rows):
        row_defects = sum(row_in.defect_counts.values())
        dhu = (row_defects / row_in.total_pcs * 100) if row_in.total_pcs else 0
        row = FinishEndlineQCHourlyRow(
            id=uuid.uuid4(), report_id=report.id, row_order=i+1,
            hour_slot=row_in.hour_slot, total_pcs=row_in.total_pcs,
            defect_counts=row_in.defect_counts,
            total_defects=row_defects, dhu_percent=dhu,
        )
        db.add(row)
        grand_pcs += row_in.total_pcs
        grand_defects += row_defects

    report.total_pcs_inspected = grand_pcs
    report.total_defects = grand_defects
    report.dhu_percent = (grand_defects / grand_pcs * 100) if grand_pcs else 0

    s, ac, re, aql_res = compute_aql(grand_pcs, grand_defects, payload.aql_standard)
    report.aql_sample_size = s; report.aql_acceptance = ac
    report.aql_rejection = re; report.aql_observed = grand_defects
    report.aql_result = aql_res

    db.commit(); db.refresh(report)
    return success_response(data=_serialize_finish_report(report), message="Report created successfully.")

@router.put("/finish-endline/{report_id}", summary="Update Finish/Endline QC Report")
def update_finish_report(report_id: str, payload: FinishQCCreate, db: Session = Depends(get_db), current_user: User = Depends(AllStaff)):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin")

    report = db.query(FinishEndlineQCReport).filter(FinishEndlineQCReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found.")
    if not is_admin and str(report.created_by) != str(current_user.id):
        raise HTTPException(403, "You do not have permission to access this report.")

    # Update header
    for field in ["style_no","po_number","article_code","product_color","shift","line","qc_name","department","inspection_level","aql_standard","remarks","prepared_by","checked_by", "vendor_id", "floor_id", "line_id"]:
        val = getattr(payload, field, None)
        if val is not None: setattr(report, field, val)
    if payload.report_date:
        report.report_date = payload.report_date
    report.defect_columns = payload.defect_columns

    # Delete old rows and recreate
    db.query(FinishEndlineQCHourlyRow).filter(FinishEndlineQCHourlyRow.report_id == report_id).delete()

    grand_pcs = 0; grand_defects = 0
    for i, row_in in enumerate(payload.hourly_rows):
        row_defects = sum(row_in.defect_counts.values())
        dhu = (row_defects / row_in.total_pcs * 100) if row_in.total_pcs else 0
        row = FinishEndlineQCHourlyRow(
            id=uuid.uuid4(), report_id=report.id, row_order=i+1,
            hour_slot=row_in.hour_slot, total_pcs=row_in.total_pcs,
            defect_counts=row_in.defect_counts,
            total_defects=row_defects, dhu_percent=dhu,
        )
        db.add(row)
        grand_pcs += row_in.total_pcs; grand_defects += row_defects

    report.total_pcs_inspected = grand_pcs; report.total_defects = grand_defects
    report.dhu_percent = (grand_defects / grand_pcs * 100) if grand_pcs else 0
    s, ac, re, aql_res = compute_aql(grand_pcs, grand_defects, payload.aql_standard)
    report.aql_sample_size = s; report.aql_acceptance = ac
    report.aql_rejection = re; report.aql_observed = grand_defects; report.aql_result = aql_res

    db.commit(); db.refresh(report)
    return success_response(data=_serialize_finish_report(report), message="Report updated.")


@router.delete("/finish-endline/{report_id}", summary="Delete Finish/Endline QC Report")
def delete_finish_report(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(AllStaff)):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin")

    report = db.query(FinishEndlineQCReport).filter(FinishEndlineQCReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found.")
    if not is_admin and str(report.created_by) != str(current_user.id):
        raise HTTPException(403, "You do not have permission to delete this report.")

    _delete_report_attachments(db, report_id)
    db.delete(report)
    db.commit()
    return success_response(message="Finish/Endline QC report deleted.")


# ─── RANDOM INLINE QC ENDPOINTS ──────────────────────────────────────────────

DEFAULT_PROCESSES = [
    {
        "name": "CUTTING",
        "control_points": [
            "Fabric identity, GSM, width and relaxation",
            "Roll/shade continuity and panel segregation",
            "Marker, ratio, grain/nap, notches and panel defects",
            "Bundle numbering and cut-panel measurements",
        ],
    },
    {
        "name": "SEWING",
        "control_points": [
            "Approved PP construction and operation sequence",
            "Seam allowance, SPI, machine setting and attachments",
            "Critical measurements, symmetry and plaid/stripe alignment",
            "Skipped/broken stitches, puckering, open seams, loose threads",
        ],
    },
    {
        "name": "PRINT / EMB.",
        "control_points": [
            "Approved strike-off, placement, size and color",
            "Registration, coverage, curing/adhesion and cleanliness",
            "Cracking/stretch performance; embroidery density/backing",
            "No damage, staining or distortion to garment",
        ],
    },
    {
        "name": "WASH / SHADE",
        "control_points": [
            "Approved wash effect and shade standard",
            "Lot/panel shade continuity and hand feel",
            "Shrinkage, spirality, pilling, lint and crocking risk",
            "No stains, wash marks, holes or garment damage",
        ],
    },
    {
        "name": "FINISHING",
        "control_points": [
            "100% thread trimming, stain and repair control",
            "Final measurements, pressing shape and appearance",
            "Labels, trims and accessories complete/correct",
            "Rejected pieces segregated and rechecked after correction",
        ],
    },
    {
        "name": "PACKING",
        "control_points": [
            "Correct style, color, size, folding and polybag",
            "Barcode, size sticker, assortment and carton quantity",
            "Carton markings, condition and sealing",
            "Metal detection / special packing requirement where applicable",
        ],
    },
]


class RandomInlineProcessRowIn(BaseModel):
    process_name:     str
    active_po_style:  Optional[str] = None
    line_area:        Optional[str] = None
    qty_checked:      int = 0
    finding_defect:   Optional[str] = None
    immediate_action: Optional[str] = None
    status:           str = "P"   # P | C | H
    total_defects:    int = 0


class RandomInlineQCReportCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    vendor_id:              Optional[uuid.UUID] = None
    floor_id:               Optional[uuid.UUID] = None
    line_id:                Optional[uuid.UUID] = None
    report_date:            Optional[date] = None
    report_no:              Optional[str] = None
    factory:                Optional[str] = None
    inspector_auditor:      Optional[str] = None
    visit_time:             Optional[str] = None
    shift:                  Optional[str] = None
    production_manager:     Optional[str] = None
    qc_manager:             Optional[str] = None
    inspection_duration:    Optional[str] = "Minimum first 2 hours"
    factory_representative: Optional[str] = None
    critical_count:         int = 0
    major_count:            int = 0
    minor_count:            int = 0
    repeat_issue:           bool = False
    overall_decision:       Optional[str] = "pass"
    verification_status:    Optional[str] = "pending"
    root_cause:             Optional[str] = None
    due_responsible:        Optional[str] = None
    production_manager_signature: Optional[str] = None
    production_manager_date:      Optional[str] = None
    qc_manager_signature:         Optional[str] = None
    qc_manager_date:              Optional[str] = None
    auditor_signature:            Optional[str] = None
    auditor_date:                 Optional[str] = None
    remarks:                Optional[str] = None
    rows:                   List[RandomInlineProcessRowIn] = []


def _serialize_random_inline_report(r: RandomInlineQCReport) -> dict:
    rows_out = []
    for row in r.rows:
        # Attach static control points from defaults
        ctrl = next(
            (p["control_points"] for p in DEFAULT_PROCESSES if p["name"] == row.process_name),
            []
        )
        rows_out.append({
            "id":              str(row.id),
            "row_order":       row.row_order,
            "process_name":    row.process_name,
            "active_po_style": row.active_po_style,
            "line_area":       row.line_area,
            "qty_checked":     row.qty_checked,
            "finding_defect":  row.finding_defect,
            "immediate_action": row.immediate_action,
            "status":          row.status,
            "total_defects":   row.total_defects,
            "control_points":  ctrl,
        })
    return {
        "id":                str(r.id),
        "report_type":       "random_inline",
        "vendor_id":         str(r.vendor_id) if r.vendor_id else None,
        "floor_id":          str(r.floor_id) if r.floor_id else None,
        "line_id":           str(r.line_id) if r.line_id else None,
        "vendor_name":       r.vendor.name if r.vendor else None,
        "floor_name":        r.floor_rel.name if r.floor_rel else None,
        "line_name":         r.line_rel.name if r.line_rel else None,
        "report_date":       str(r.report_date) if r.report_date else None,
        "report_no":         r.report_no,
        "factory":           r.factory,
        "inspector_auditor": r.inspector_auditor,
        "visit_time":        r.visit_time,
        "shift":             r.shift,
        "production_manager":     r.production_manager,
        "qc_manager":             r.qc_manager,
        "inspection_duration":    r.inspection_duration,
        "factory_representative": r.factory_representative,
        "critical_count":         r.critical_count,
        "major_count":            r.major_count,
        "minor_count":            r.minor_count,
        "repeat_issue":           r.repeat_issue,
        "overall_decision":       r.overall_decision,
        "verification_status":    r.verification_status,
        "root_cause":             r.root_cause,
        "due_responsible":        r.due_responsible,
        "production_manager_signature": r.production_manager_signature,
        "production_manager_date":      r.production_manager_date,
        "qc_manager_signature":         r.qc_manager_signature,
        "qc_manager_date":              r.qc_manager_date,
        "auditor_signature":            r.auditor_signature,
        "auditor_date":                 r.auditor_date,
        "total_defects":   r.total_defects,
        "total_processes": r.total_processes,
        "processes_passed": r.processes_passed,
        "remarks":         r.remarks,
        "created_at":      r.created_at.isoformat() if r.created_at else None,
        "rows":            rows_out,
        "default_processes": DEFAULT_PROCESSES,
    }


@router.get("/random-inline/", summary="List Random Inline QC Reports")
def list_random_inline_reports(
    skip: int = 0, limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(AdvancedQCReadAccess)
):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin", "viewer")

    q = db.query(RandomInlineQCReport).options(
        joinedload(RandomInlineQCReport.vendor),
        joinedload(RandomInlineQCReport.floor_rel),
        joinedload(RandomInlineQCReport.line_rel),
        joinedload(RandomInlineQCReport.rows),
    )
    if not is_admin:
        q = q.filter(RandomInlineQCReport.created_by == current_user.id)
    reports = q.order_by(RandomInlineQCReport.created_at.desc()).offset(skip).limit(limit).all()
    return success_response(data=[_serialize_random_inline_report(r) for r in reports])


@router.get("/random-inline/{report_id}", summary="Get Random Inline QC Report")
def get_random_inline_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(AdvancedQCReadAccess)
):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin", "viewer")

    report = db.query(RandomInlineQCReport).options(
        joinedload(RandomInlineQCReport.vendor),
        joinedload(RandomInlineQCReport.floor_rel),
        joinedload(RandomInlineQCReport.line_rel),
        joinedload(RandomInlineQCReport.rows),
    ).filter(RandomInlineQCReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Random Inline QC report not found.")
    if not is_admin and str(report.created_by) != str(current_user.id):
        raise HTTPException(403, "You do not have permission to access this report.")
    return success_response(data=_serialize_random_inline_report(report))


@router.post("/random-inline/", summary="Create Random Inline QC Report")
def create_random_inline_report(
    payload: RandomInlineQCReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(AllStaff)
):
    report = RandomInlineQCReport(
        id=uuid.uuid4(),
        vendor_id=payload.vendor_id,
        floor_id=payload.floor_id,
        line_id=payload.line_id,
        report_date=payload.report_date or date.today(),
        report_no=payload.report_no,
        factory=payload.factory,
        inspector_auditor=payload.inspector_auditor,
        visit_time=payload.visit_time,
        shift=payload.shift,
        production_manager=payload.production_manager,
        qc_manager=payload.qc_manager,
        inspection_duration=payload.inspection_duration,
        factory_representative=payload.factory_representative,
        critical_count=payload.critical_count,
        major_count=payload.major_count,
        minor_count=payload.minor_count,
        repeat_issue=payload.repeat_issue,
        overall_decision=payload.overall_decision,
        verification_status=payload.verification_status,
        root_cause=payload.root_cause,
        due_responsible=payload.due_responsible,
        production_manager_signature=payload.production_manager_signature,
        production_manager_date=payload.production_manager_date,
        qc_manager_signature=payload.qc_manager_signature,
        qc_manager_date=payload.qc_manager_date,
        auditor_signature=payload.auditor_signature,
        auditor_date=payload.auditor_date,
        remarks=payload.remarks,
        created_by=current_user.id,
    )
    db.add(report)
    db.flush()

    total_defects = 0
    processes_passed = 0
    for index, row_in in enumerate(payload.rows):
        row = RandomInlineQCProcessRow(
            id=uuid.uuid4(),
            report_id=report.id,
            row_order=index + 1,
            process_name=row_in.process_name,
            active_po_style=row_in.active_po_style,
            line_area=row_in.line_area,
            qty_checked=row_in.qty_checked,
            finding_defect=row_in.finding_defect,
            immediate_action=row_in.immediate_action,
            status=row_in.status,
            total_defects=row_in.total_defects,
        )
        db.add(row)
        total_defects += row_in.total_defects
        if row_in.status == "P":
            processes_passed += 1

    report.total_defects = total_defects
    report.total_processes = len(payload.rows) or 6
    report.processes_passed = processes_passed

    db.commit()
    db.refresh(report)
    return success_response(data=_serialize_random_inline_report(report), message="Random Inline QC report created.")


@router.put("/random-inline/{report_id}", summary="Update Random Inline QC Report")
def update_random_inline_report(
    report_id: str,
    payload: RandomInlineQCReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(AllStaff)
):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin")

    report = db.query(RandomInlineQCReport).options(
        joinedload(RandomInlineQCReport.rows)
    ).filter(RandomInlineQCReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Random Inline QC report not found.")
    if not is_admin and str(report.created_by) != str(current_user.id):
        raise HTTPException(403, "You do not have permission to edit this report.")

    # Update header fields
    header_fields = [
        "vendor_id", "floor_id", "line_id", "report_date", "report_no",
        "factory", "inspector_auditor", "visit_time", "shift",
        "production_manager", "qc_manager", "inspection_duration", "factory_representative",
        "critical_count", "major_count", "minor_count", "repeat_issue",
        "overall_decision", "verification_status", "root_cause", "due_responsible",
        "production_manager_signature", "production_manager_date",
        "qc_manager_signature", "qc_manager_date",
        "auditor_signature", "auditor_date", "remarks",
    ]
    for field in header_fields:
        val = getattr(payload, field, None)
        if val is not None:
            setattr(report, field, val)

    # Replace rows
    for row in report.rows:
        db.delete(row)
    db.flush()

    total_defects = 0
    processes_passed = 0
    for index, row_in in enumerate(payload.rows):
        row = RandomInlineQCProcessRow(
            id=uuid.uuid4(),
            report_id=report.id,
            row_order=index + 1,
            process_name=row_in.process_name,
            active_po_style=row_in.active_po_style,
            line_area=row_in.line_area,
            qty_checked=row_in.qty_checked,
            finding_defect=row_in.finding_defect,
            immediate_action=row_in.immediate_action,
            status=row_in.status,
            total_defects=row_in.total_defects,
        )
        db.add(row)
        total_defects += row_in.total_defects
        if row_in.status == "P":
            processes_passed += 1

    report.total_defects = total_defects
    report.total_processes = len(payload.rows) or 6
    report.processes_passed = processes_passed

    db.commit()
    db.refresh(report)
    return success_response(data=_serialize_random_inline_report(report), message="Random Inline QC report updated.")


@router.delete("/random-inline/{report_id}", summary="Delete Random Inline QC Report")
def delete_random_inline_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(AllStaff)
):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin")

    report = db.query(RandomInlineQCReport).filter(RandomInlineQCReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Random Inline QC report not found.")
    if not is_admin and str(report.created_by) != str(current_user.id):
        raise HTTPException(403, "You do not have permission to delete this report.")

    _delete_report_attachments(db, report_id)
    db.delete(report)
    db.commit()
    return success_response(message="Random Inline QC report deleted.")
