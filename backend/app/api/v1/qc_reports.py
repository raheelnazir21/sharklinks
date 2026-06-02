"""
QC Reports API V2 — Inspection management, Defect Master,
Operator Flags, Attachments, and Article Code endpoints.
"""
import os
import uuid
import shutil
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from fastapi.responses import FileResponse

from app.core.database import get_db
from app.core.dependencies import require_roles, get_current_user
from app.models.user import RoleEnum, User
from app.models.qc_report import (
    QCReport, QCReportItem, QCReportAttachment,
    OperatorFlag, OperatorFlagHistory, FlagColor,
    ReportStatus, DefectCode
)
from app.models.inline_qc import (
    InlineQCReport, InlineQCOperation, InlineQCDefectRow,
    FinishEndlineQCReport, FinishEndlineQCHourlyRow,
    CutPanelReport, BatchAuditReport
)
from app.schemas.qc_report import (
    QCReportCreate, DefectCategoryCreate, DefectCodeCreate, AnalyticsSummary,
    OperatorFlagCreate, OperatorFlagUpdate,
)
from app.services.qc_service import QCService, DefectMasterService
from app.services.activity_log_service import ActivityLogService
from app.repositories.qc_report_repo import QCReportRepository, DefectMasterRepository
from app.utils.response import success_response

router = APIRouter(prefix="/qc-reports", tags=["QC Reports"], redirect_slashes=True)

QCAccess      = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager, RoleEnum.qc_officer])
ManagerAccess = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager])

QC_ATTACHMENTS_DIR = "uploads/qc_attachments"
os.makedirs(QC_ATTACHMENTS_DIR, exist_ok=True)


# ─── Analytics ────────────────────────────────────────────────────────────────

@router.get("/analytics", response_model=dict, summary="Get Quality Analytics")
@router.get("/analytics/", response_model=dict, summary="Get Quality Analytics")
def get_analytics(db: Session = Depends(get_db), _=Depends(QCAccess)):
    base = QCService.get_analytics(db)

    inline_reports = db.query(InlineQCReport).all()
    finish_reports = db.query(FinishEndlineQCReport).all()
    cut_panel_reports = db.query(CutPanelReport).all()
    batch_audit_reports = db.query(BatchAuditReport).all()
    advanced_reports = inline_reports + finish_reports + cut_panel_reports + batch_audit_reports

    total_inspections = (base.get("total_inspections") or 0) + len(advanced_reports)
    total_defects = (base.get("total_defects") or 0) + sum(r.total_defects or 0 for r in advanced_reports)
    checked_total = sum(getattr(r, "total_checked_pcs", 0) or 0 for r in inline_reports)
    checked_total += sum(getattr(r, "total_pcs_inspected", 0) or 0 for r in finish_reports)
    checked_total += sum(getattr(r, "total_checked", 0) or 0 for r in cut_panel_reports)
    checked_total += sum(getattr(r, "total_sample_qty", 0) or 0 for r in batch_audit_reports)

    weighted_dhu = sum((r.dhu_percent or 0) * (getattr(r, "total_checked_pcs", 0) or 0) for r in inline_reports)
    weighted_dhu += sum((r.dhu_percent or 0) * (getattr(r, "total_pcs_inspected", 0) or 0) for r in finish_reports)
    weighted_dhu += sum((r.defect_percent or 0) * (getattr(r, "total_checked", 0) or 0) for r in cut_panel_reports)
    weighted_dhu += sum((r.oqi_percent or 0) * (getattr(r, "total_sample_qty", 0) or 0) for r in batch_audit_reports)
    avg_dhu = round(weighted_dhu / checked_total, 2) if checked_total else base.get("avg_dhu", 0)

    top_defects: dict[str, int] = {d["name"]: d["count"] for d in base.get("top_defects", [])}
    for row in db.query(InlineQCDefectRow).all():
        top_defects[row.defect_name] = top_defects.get(row.defect_name, 0) + (row.total_defects or 0)
    for hourly in db.query(FinishEndlineQCHourlyRow).all():
        for name, count in (hourly.defect_counts or {}).items():
            top_defects[name] = top_defects.get(name, 0) + int(count or 0)
    for report in cut_panel_reports:
        for row in report.rows:
            for col in report.defect_columns or []:
                name = col.get("name", col.get("id", "Defect"))
                count = int((row.defect_counts or {}).get(col.get("id"), 0) or 0)
                top_defects[name] = top_defects.get(name, 0) + count
    for report in batch_audit_reports:
        for row in report.rows:
            for col in report.fault_columns or []:
                name = col.get("name", col.get("id", "Fault"))
                count = int((row.fault_counts or {}).get(col.get("id"), 0) or 0)
                top_defects[name] = top_defects.get(name, 0) + count

    base.update({
        "total_inspections": total_inspections,
        "total_defects": total_defects,
        "avg_dhu": avg_dhu,
        "avg_fpy": base.get("avg_fpy", 0),
        "top_defects": [
            {"name": name, "count": count}
            for name, count in sorted(top_defects.items(), key=lambda item: item[1], reverse=True)[:5]
            if count
        ],
    })
    return success_response(data=base)


# ─── Defect Master ────────────────────────────────────────────────────────────

@router.get("/defect-categories", summary="List Defect Categories")
@router.get("/defect-categories/", summary="List Defect Categories")
def list_categories(
    report_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(QCAccess),
):
    cats = DefectMasterRepository.get_categories(db, report_type=report_type)
    return success_response(data=[{"id": c.id, "name": c.name, "report_type": c.report_type} for c in cats])


@router.post("/defect-categories", summary="Create Defect Category")
@router.post("/defect-categories/", summary="Create Defect Category")
def create_category(payload: DefectCategoryCreate, db: Session = Depends(get_db), _=Depends(ManagerAccess)):
    cat = DefectMasterRepository.create_category(db, payload.model_dump())
    return success_response(data={"id": cat.id}, message="Category created.")


@router.get("/defect-codes", summary="List Defect Codes")
@router.get("/defect-codes/", summary="List Defect Codes")
def list_defects(
    report_type: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(QCAccess),
):
    codes = DefectMasterRepository.get_defects(db, report_type=report_type, category_id=category_id)
    return success_response(data=[
        {"id": c.id, "name": c.name, "code": c.code, "severity": c.severity, "category_id": c.category_id}
        for c in codes
    ])


@router.post("/defect-codes", summary="Create Defect Code")
@router.post("/defect-codes/", summary="Create Defect Code")
def create_defect(payload: DefectCodeCreate, db: Session = Depends(get_db), _=Depends(ManagerAccess)):
    df = DefectMasterRepository.create_defect(db, payload.model_dump())
    return success_response(data={"id": df.id, "code": df.code}, message="Defect code created.")


# ─── QC Reports List / Create ─────────────────────────────────────────────────

@router.get("", summary="List QC Reports")
@router.get("/", summary="List QC Reports")
def list_reports(
    vendor_id: Optional[str] = Query(None),
    report_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(QCAccess),
):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin")
    user_id_filter = None if is_admin else current_user.id

    reports = QCReportRepository.get_all(db, vendor_id=vendor_id, report_type=report_type, status=status, user_id=user_id_filter)
    data = [
        {
            "id": str(r.id),
            "report_type": r.report_type,
            "status": r.status,
            "vendor_name": r.vendor.name if r.vendor else None,
            "style_name": r.order.style_name if r.order else None,
            "inspection_date": str(r.inspection_date),
            "total_defects": r.total_defects,
            "dhu_percent": r.dhu_percent,
            "article_code": r.article_code.code if r.article_code else None,
            "product_color": r.product_color.color_name if r.product_color else None,
        }
        for r in reports
    ]

    if not report_type or report_type == "inline":
        inline_q = db.query(InlineQCReport)
        if vendor_id:
            inline_q = inline_q.filter(InlineQCReport.vendor_id == vendor_id)
        if not is_admin:
            inline_q = inline_q.filter(InlineQCReport.created_by == current_user.id)
        for r in inline_q.order_by(InlineQCReport.created_at.desc()).all():
            data.append({
                "id": str(r.id),
                "report_type": "inline",
                "status": "submitted",
                "vendor_name": r.vendor.name if r.vendor else None,
                "style_name": r.style_no or r.po_number,
                "inspection_date": str(r.inspection_date),
                "total_defects": r.total_defects,
                "dhu_percent": round(r.dhu_percent or 0, 2),
                "article_code": r.article_code,
                "product_color": r.product_color,
            })

    if not report_type or report_type in ("finish", "endline"):
        finish_q = db.query(FinishEndlineQCReport)
        if vendor_id:
            finish_q = finish_q.filter(FinishEndlineQCReport.vendor_id == vendor_id)
        if report_type in ("finish", "endline"):
            finish_q = finish_q.filter(FinishEndlineQCReport.report_type == report_type)
        if not is_admin:
            finish_q = finish_q.filter(FinishEndlineQCReport.created_by == current_user.id)
        for r in finish_q.order_by(FinishEndlineQCReport.created_at.desc()).all():
            rtype = r.report_type.value if hasattr(r.report_type, "value") else r.report_type
            data.append({
                "id": str(r.id),
                "report_type": rtype,
                "status": "submitted",
                "vendor_name": r.vendor.name if r.vendor else None,
                "style_name": r.style_no or r.po_number,
                "inspection_date": str(r.report_date),
                "total_defects": r.total_defects,
                "dhu_percent": round(r.dhu_percent or 0, 2),
                "article_code": r.article_code,
                "product_color": r.product_color,
            })

    if not report_type or report_type == "cut_panel":
        cut_q = db.query(CutPanelReport)
        if vendor_id:
            cut_q = cut_q.filter(CutPanelReport.vendor_id == vendor_id)
        if not is_admin:
            cut_q = cut_q.filter(CutPanelReport.created_by == current_user.id)
        for r in cut_q.order_by(CutPanelReport.created_at.desc()).all():
            data.append({
                "id": str(r.id),
                "report_type": "cut_panel",
                "status": "submitted",
                "vendor_name": r.vendor.name if r.vendor else None,
                "style_name": r.style_no or r.po_number or r.lot_number,
                "inspection_date": str(r.report_date),
                "total_defects": r.total_defects,
                "dhu_percent": round(r.defect_percent or 0, 2),
                "article_code": r.article_code,
                "product_color": r.product_color,
            })

    if not report_type or report_type == "batch_audit":
        batch_q = db.query(BatchAuditReport)
        if vendor_id:
            batch_q = batch_q.filter(BatchAuditReport.vendor_id == vendor_id)
        if not is_admin:
            batch_q = batch_q.filter(BatchAuditReport.created_by == current_user.id)
        for r in batch_q.order_by(BatchAuditReport.created_at.desc()).all():
            data.append({
                "id": str(r.id),
                "report_type": "batch_audit",
                "status": "submitted",
                "vendor_name": r.vendor.name if r.vendor else None,
                "style_name": r.style_no or r.product_name or r.unit_number,
                "inspection_date": str(r.report_date),
                "total_defects": r.total_faults,
                "dhu_percent": round(r.oqi_percent or 0, 2),
                "article_code": r.stm,
                "product_color": r.product_color,
            })

    return success_response(data=data)


@router.post("", summary="Submit QC Report")
@router.post("/", summary="Submit QC Report")
def submit_report(
    payload: QCReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(QCAccess),
):
    report = QCService.create_report(db, payload, str(current_user.id))
    ActivityLogService.record(
        db,
        action="QC_REPORT_CREATED",
        entity_type="QCReport",
        entity_id=str(report.id),
        user=current_user,
        payload={"details": f"{report.report_type.value if hasattr(report.report_type, 'value') else report.report_type} report submitted."},
    )
    return success_response(
        data={"id": str(report.id), "dhu_percent": report.dhu_percent, "fpy_percent": report.fpy_percent},
        message="QC Report submitted successfully."
    )


# ─── Pending Approvals ────────────────────────────────────────────────────────

@router.get("/pending-approvals", summary="List Pending QC Reports for Approval")
@router.get("/pending-approvals/", summary="List Pending QC Reports for Approval")
def list_pending_reports(db: Session = Depends(get_db), _=Depends(ManagerAccess)):
    reports = QCService.list_reports(db, status=ReportStatus.submitted)
    return success_response(data=[
        {
            "id": str(r.id),
            "report_type": r.report_type,
            "order_no": r.order.order_no if r.order else "N/A",
            "vendor_name": r.vendor.name if r.vendor else "N/A",
            "submitted_at": str(r.created_at),
            "total_pieces": r.quantity_checked,
            "fail_pieces": r.total_defects,
            "checker_name": r.auditor_name,
        }
        for r in reports
    ])


@router.put("/{report_id}/approve", summary="Approve QC Report")
def approve_report(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(ManagerAccess)):
    QCService.approve_report(db, report_id, str(current_user.id))
    ActivityLogService.record(
        db,
        action="QC_REPORT_APPROVED",
        entity_type="QCReport",
        entity_id=report_id,
        user=current_user,
        payload={"details": "QC report approved."},
    )
    return success_response(message="Report approved.")


@router.put("/{report_id}/reject", summary="Reject QC Report")
def reject_report(report_id: str, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(ManagerAccess)):
    QCService.reject_report(db, report_id, str(current_user.id))
    ActivityLogService.record(
        db,
        action="QC_REPORT_REJECTED",
        entity_type="QCReport",
        entity_id=report_id,
        user=current_user,
        payload={"details": "QC report rejected.", "reason": payload.get("reason") or payload.get("remarks")},
    )
    return success_response(message="Report rejected.")


# ─── Detailed Logs ────────────────────────────────────────────────────────────

@router.get("/detailed-logs", summary="Get Flattened QC Item Logs")
@router.get("/detailed-logs/", summary="Get Flattened QC Item Logs")
def list_detailed_logs(
    vendor_id: Optional[str] = Query(None),
    report_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(QCAccess),
):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin")
    user_id_filter = None if is_admin else current_user.id

    items, total = QCReportRepository.get_flattened_logs(
        db, vendor_id=vendor_id, report_type=report_type, skip=skip, limit=limit, user_id=user_id_filter
    )
    logs = [
            {
                "id": str(i.id),
                "report_id": str(i.report_id),
                "date": str(i.item_date or i.report.inspection_date),
                "hour": i.hour,
                "batch_size": i.batch_size,
                "vendor_name": i.report.vendor.name if i.report.vendor else None,
                "floor_name": i.report.floor.name if i.report.floor else None,
                "line_name": i.report.line.name if i.report.line else None,
                "style_name": i.report.order.style_name if i.report.order else None,
                "article_code": i.report.article_code.code if i.report.article_code else None,
                "product_color": i.report.product_color.color_name if i.report.product_color else None,
                "report_type": i.report.report_type,
                "operation": i.operation,
                "corrective_action": i.corrective_action,
                "remarks": i.remarks,
                "defects": [
                    {
                        "defect_name": e.defect.name if e.defect else None,
                        "defect_code": e.defect.code if e.defect else None,
                        "count": e.defect_count,
                        "severity": e.severity,
                    }
                    for e in i.defect_entries
                ] if i.defect_entries else [
                    {
                        "defect_name": i.defect.name if i.defect else None,
                        "defect_code": i.defect.code if i.defect else None,
                        "count": i.defect_count,
                        "severity": i.severity,
                    }
                ],
                "auditor_name": i.report.auditor_name,
            }
            for i in items
        ]

    if not report_type or report_type == "inline":
        inline_q = db.query(InlineQCDefectRow).join(InlineQCOperation).join(InlineQCReport)
        if vendor_id:
            inline_q = inline_q.filter(InlineQCReport.vendor_id == vendor_id)
        if not is_admin:
            inline_q = inline_q.filter(InlineQCReport.created_by == current_user.id)
        for row in inline_q.order_by(InlineQCReport.inspection_date.desc()).all():
            report = row.operation.report
            first_hour = (row.hourly_data or [{}])[0]
            logs.append({
                "id": str(row.id),
                "report_id": str(report.id),
                "date": str(report.inspection_date),
                "hour": first_hour.get("hour", ""),
                "batch_size": row.total_checked,
                "vendor_name": report.vendor.name if report.vendor else None,
                "floor_name": report.floor_rel.name if report.floor_rel else report.floor,
                "line_name": report.line.name if report.line else report.line_number,
                "style_name": report.style_no or report.po_number,
                "article_code": report.article_code,
                "product_color": report.product_color,
                "report_type": "inline",
                "operation": row.operation.operation_name,
                "corrective_action": "",
                "remarks": report.remarks,
                "defects": [{
                    "defect_name": row.defect_name,
                    "defect_code": row.defect_id,
                    "count": row.total_defects,
                    "severity": row.severity,
                }],
                "auditor_name": report.qc_name,
            })

    if not report_type or report_type in ("finish", "endline"):
        finish_q = db.query(FinishEndlineQCHourlyRow).join(FinishEndlineQCReport)
        if vendor_id:
            finish_q = finish_q.filter(FinishEndlineQCReport.vendor_id == vendor_id)
        if report_type in ("finish", "endline"):
            finish_q = finish_q.filter(FinishEndlineQCReport.report_type == report_type)
        if not is_admin:
            finish_q = finish_q.filter(FinishEndlineQCReport.created_by == current_user.id)
        for row in finish_q.order_by(FinishEndlineQCReport.report_date.desc(), FinishEndlineQCHourlyRow.row_order.asc()).all():
            report = row.report
            rtype = report.report_type.value if hasattr(report.report_type, "value") else report.report_type
            logs.append({
                "id": str(row.id),
                "report_id": str(report.id),
                "date": str(report.report_date),
                "hour": row.hour_slot,
                "batch_size": row.total_pcs,
                "vendor_name": report.vendor.name if report.vendor else None,
                "floor_name": report.floor_rel.name if report.floor_rel else None,
                "line_name": report.line_rel.name if report.line_rel else report.line,
                "style_name": report.style_no or report.po_number,
                "article_code": report.article_code,
                "product_color": report.product_color,
                "report_type": rtype,
                "operation": "",
                "corrective_action": "",
                "remarks": report.remarks,
                "defects": [
                    {
                        "defect_name": name,
                        "defect_code": None,
                        "count": int(count or 0),
                        "severity": "major",
                    }
                    for name, count in (row.defect_counts or {}).items()
                    if int(count or 0) > 0
                ],
                "auditor_name": report.qc_name,
            })

    if not report_type or report_type == "cut_panel":
        cut_q = db.query(CutPanelReport)
        if vendor_id:
            cut_q = cut_q.filter(CutPanelReport.vendor_id == vendor_id)
        if not is_admin:
            cut_q = cut_q.filter(CutPanelReport.created_by == current_user.id)
        for report in cut_q.order_by(CutPanelReport.report_date.desc()).all():
            for row in report.rows:
                defects = []
                for col in report.defect_columns or []:
                    count = int((row.defect_counts or {}).get(col.get("id"), 0) or 0)
                    if count > 0:
                        defects.append({
                            "defect_name": col.get("name"),
                            "defect_code": col.get("section"),
                            "count": count,
                            "severity": "major",
                        })
                logs.append({
                    "id": str(row.id),
                    "report_id": str(report.id),
                    "date": str(report.report_date),
                    "hour": row.bundle_number or "",
                    "batch_size": row.pcs,
                    "vendor_name": report.vendor.name if report.vendor else None,
                    "floor_name": report.floor_rel.name if report.floor_rel else None,
                    "line_name": report.line_rel.name if report.line_rel else None,
                    "style_name": report.style_no or report.po_number,
                    "article_code": report.article_code,
                    "product_color": report.product_color,
                    "report_type": "cut_panel",
                    "operation": row.size or "",
                    "corrective_action": "",
                    "remarks": report.remarks,
                    "defects": defects,
                    "auditor_name": report.qc_name,
                })

    if not report_type or report_type == "batch_audit":
        batch_q = db.query(BatchAuditReport)
        if vendor_id:
            batch_q = batch_q.filter(BatchAuditReport.vendor_id == vendor_id)
        if not is_admin:
            batch_q = batch_q.filter(BatchAuditReport.created_by == current_user.id)
        for report in batch_q.order_by(BatchAuditReport.report_date.desc()).all():
            for row in report.rows:
                defects = []
                for col in report.fault_columns or []:
                    count = int((row.fault_counts or {}).get(col.get("id"), 0) or 0)
                    if count > 0:
                        defects.append({
                            "defect_name": col.get("name"),
                            "defect_code": col.get("code"),
                            "count": count,
                            "severity": col.get("section", "major"),
                        })
                logs.append({
                    "id": str(row.id),
                    "report_id": str(report.id),
                    "date": str(report.report_date),
                    "hour": row.batch_number or "",
                    "batch_size": row.sample_size,
                    "vendor_name": report.vendor.name if report.vendor else None,
                    "floor_name": report.floor_rel.name if report.floor_rel else None,
                    "line_name": report.line_rel.name if report.line_rel else None,
                    "style_name": report.style_no or report.product_name,
                    "article_code": report.stm,
                    "product_color": report.product_color,
                    "report_type": "batch_audit",
                    "operation": row.result or "",
                    "corrective_action": "",
                    "remarks": row.remarks or report.remarks,
                    "defects": defects,
                    "auditor_name": report.qc_name,
                })

    combined_total = len(logs)
    logs = logs[skip: skip + limit]
    return success_response(data={"total": combined_total, "items": logs})


# ─── Report Detail ────────────────────────────────────────────────────────────

@router.get("/{report_id:uuid}", summary="Get QC Report Detail")
def get_report_detail(
    report_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(QCAccess),
):
    role_name = current_user.role.name.value if hasattr(current_user.role.name, "value") else current_user.role.name
    is_admin = role_name in ("super_admin", "admin")
    report_id_str = str(report_id)
    report = QCReportRepository.get_by_id(db, report_id_str)
    if not report:
        inline = db.query(InlineQCReport).filter(InlineQCReport.id == report_id_str).first()
        if inline:
            if not is_admin and str(inline.created_by) != str(current_user.id):
                raise HTTPException(403, "You do not have permission to access this report.")
            items = []
            for op in inline.operations:
                for row in op.defect_rows:
                    first_hour = (row.hourly_data or [{}])[0]
                    items.append({
                        "id": str(row.id),
                        "hour": first_hour.get("hour", ""),
                        "batch_size": row.total_checked,
                        "item_date": str(inline.inspection_date),
                        "operation": op.operation_name,
                        "defect_code": row.defect_id,
                        "defect_name": row.defect_name,
                        "count": row.total_defects,
                        "severity": row.severity,
                        "remarks": inline.remarks,
                    })
            attachments = [
                {
                    "id":          str(a.id),
                    "file_name":   a.file_name,
                    "mime_type":   a.mime_type,
                    "file_size":   a.file_size,
                    "uploaded_at": str(a.uploaded_at),
                }
                for a in db.query(QCReportAttachment).filter(QCReportAttachment.report_id == report_id_str).all()
            ]
            return success_response(data={
                "id": str(inline.id),
                "header": {
                    "report_type": "inline",
                    "vendor_name": inline.vendor.name if inline.vendor else None,
                    "floor_name": inline.floor_rel.name if inline.floor_rel else inline.floor,
                    "line_name": inline.line.name if inline.line else inline.line_number,
                    "order_no": inline.po_number,
                    "style_name": inline.style_no,
                    "article_code": inline.article_code,
                    "product_color": inline.product_color,
                    "inspection_date": str(inline.inspection_date),
                    "shift": inline.shift,
                    "auditor_name": inline.qc_name,
                    "quantity_checked": inline.total_checked_pcs,
                    "quantity_passed": max(0, (inline.total_checked_pcs or 0) - (inline.total_defects or 0)),
                    "quantity_rejected": inline.total_defects,
                    "dhu_percent": round(inline.dhu_percent or 0, 2),
                    "fpy_percent": round(inline.overall_pass_pct or 0, 2),
                    "total_defects": inline.total_defects,
                    "status": "submitted",
                    "remarks": inline.remarks,
                    "stage": inline.department,
                },
                "items": items,
                "attachments": attachments,
            })

        finish = db.query(FinishEndlineQCReport).filter(FinishEndlineQCReport.id == report_id_str).first()
        if finish:
            if not is_admin and str(finish.created_by) != str(current_user.id):
                raise HTTPException(403, "You do not have permission to access this report.")
            items = []
            for row in finish.hourly_rows:
                for name, count in (row.defect_counts or {}).items():
                    if int(count or 0) <= 0:
                        continue
                    items.append({
                        "id": str(row.id),
                        "hour": row.hour_slot,
                        "batch_size": row.total_pcs,
                        "item_date": str(finish.report_date),
                        "operation": "",
                        "defect_code": None,
                        "defect_name": name,
                        "count": int(count or 0),
                        "severity": "major",
                        "remarks": finish.remarks,
                    })
            rtype = finish.report_type.value if hasattr(finish.report_type, "value") else finish.report_type
            attachments = [
                {
                    "id":          str(a.id),
                    "file_name":   a.file_name,
                    "mime_type":   a.mime_type,
                    "file_size":   a.file_size,
                    "uploaded_at": str(a.uploaded_at),
                }
                for a in db.query(QCReportAttachment).filter(QCReportAttachment.report_id == report_id_str).all()
            ]
            return success_response(data={
                "id": str(finish.id),
                "header": {
                    "report_type": rtype,
                    "vendor_name": finish.vendor.name if finish.vendor else None,
                    "floor_name": finish.floor_rel.name if finish.floor_rel else None,
                    "line_name": finish.line_rel.name if finish.line_rel else finish.line,
                    "order_no": finish.po_number,
                    "style_name": finish.style_no,
                    "article_code": finish.article_code,
                    "product_color": finish.product_color,
                    "inspection_date": str(finish.report_date),
                    "shift": finish.shift,
                    "auditor_name": finish.qc_name,
                    "quantity_checked": finish.total_pcs_inspected,
                    "quantity_passed": max(0, (finish.total_pcs_inspected or 0) - (finish.total_defects or 0)),
                    "quantity_rejected": finish.total_defects,
                    "dhu_percent": round(finish.dhu_percent or 0, 2),
                    "fpy_percent": 0,
                    "total_defects": finish.total_defects,
                    "status": "submitted",
                    "remarks": finish.remarks,
                    "stage": finish.department,
                },
                "items": items,
                "attachments": attachments,
            })

        cut = db.query(CutPanelReport).filter(CutPanelReport.id == report_id_str).first()
        if cut:
            if not is_admin and str(cut.created_by) != str(current_user.id):
                raise HTTPException(403, "You do not have permission to access this report.")
            items = []
            for row in cut.rows:
                for name, count in (row.defect_counts or {}).items():
                    if int(count or 0) <= 0:
                        continue
                    items.append({
                        "id": str(row.id),
                        "hour": "",
                        "batch_size": row.pcs,
                        "item_date": str(cut.report_date),
                        "operation": f"Bundle: {row.bundle_number or ''} (Size: {row.size or ''})",
                        "defect_code": None,
                        "defect_name": name,
                        "count": int(count or 0),
                        "severity": "major",
                        "remarks": cut.remarks,
                    })
            attachments = [
                {
                    "id":          str(a.id),
                    "file_name":   a.file_name,
                    "mime_type":   a.mime_type,
                    "file_size":   a.file_size,
                    "uploaded_at": str(a.uploaded_at),
                }
                for a in db.query(QCReportAttachment).filter(QCReportAttachment.report_id == report_id_str).all()
            ]
            return success_response(data={
                "id": str(cut.id),
                "header": {
                    "report_type": "cut_panel",
                    "vendor_name": cut.vendor.name if cut.vendor else None,
                    "floor_name": cut.floor_rel.name if cut.floor_rel else None,
                    "line_name": cut.line_rel.name if cut.line_rel else cut.line_id,
                    "order_no": cut.po_number,
                    "style_name": cut.style_no,
                    "article_code": cut.article_code,
                    "product_color": cut.product_color,
                    "inspection_date": str(cut.report_date),
                    "shift": cut.shift,
                    "auditor_name": cut.qc_name,
                    "quantity_checked": cut.total_checked,
                    "quantity_passed": max(0, (cut.total_checked or 0) - (cut.total_defects or 0)),
                    "quantity_rejected": cut.total_defects,
                    "dhu_percent": round(cut.defect_percent or 0, 2),
                    "fpy_percent": 0,
                    "total_defects": cut.total_defects,
                    "status": "submitted",
                    "remarks": cut.remarks,
                    "stage": cut.department,
                },
                "items": items,
                "attachments": attachments,
            })

        batch = db.query(BatchAuditReport).filter(BatchAuditReport.id == report_id_str).first()
        if batch:
            if not is_admin and str(batch.created_by) != str(current_user.id):
                raise HTTPException(403, "You do not have permission to access this report.")
            items = []
            for row in batch.rows:
                for name, count in (row.fault_counts or {}).items():
                    if int(count or 0) <= 0:
                        continue
                    items.append({
                        "id": str(row.id),
                        "hour": "",
                        "batch_size": row.sample_size,
                        "item_date": str(batch.report_date),
                        "operation": f"Batch: {row.batch_number or ''} (Result: {row.result or ''})",
                        "defect_code": None,
                        "defect_name": name,
                        "count": int(count or 0),
                        "severity": "major",
                        "remarks": row.remarks or batch.remarks,
                    })
            attachments = [
                {
                    "id":          str(a.id),
                    "file_name":   a.file_name,
                    "mime_type":   a.mime_type,
                    "file_size":   a.file_size,
                    "uploaded_at": str(a.uploaded_at),
                }
                for a in db.query(QCReportAttachment).filter(QCReportAttachment.report_id == report_id_str).all()
            ]
            return success_response(data={
                "id": str(batch.id),
                "header": {
                    "report_type": "batch_audit",
                    "vendor_name": batch.vendor.name if batch.vendor else None,
                    "floor_name": batch.floor_rel.name if batch.floor_rel else None,
                    "line_name": batch.line_rel.name if batch.line_rel else batch.line_id,
                    "order_no": batch.unit_number,
                    "style_name": batch.style_no,
                    "article_code": batch.stm,
                    "product_color": batch.product_color,
                    "inspection_date": str(batch.report_date),
                    "shift": batch.shift,
                    "auditor_name": batch.qc_name,
                    "quantity_checked": batch.total_sample_qty,
                    "quantity_passed": batch.first_pass_qty + batch.second_pass_qty,
                    "quantity_rejected": batch.total_sample_qty - (batch.first_pass_qty + batch.second_pass_qty),
                    "dhu_percent": round(batch.oqi_percent or 0, 2),
                    "fpy_percent": round(batch.fpy_percent or 0, 2),
                    "total_defects": batch.total_faults,
                    "status": "submitted",
                    "remarks": batch.remarks,
                    "stage": batch.department,
                },
                "items": items,
                "attachments": attachments,
            })

        raise HTTPException(404, "Report not found.")

    def _item_out(item: QCReportItem):
        defects = [
            {
                "id": str(e.id),
                "defect_id": e.defect_id,
                "defect_name": e.defect.name if e.defect else None,
                "defect_code": e.defect.code if e.defect else None,
                "count": e.defect_count,
                "severity": e.severity,
            }
            for e in item.defect_entries
        ] if item.defect_entries else [
            {
                "defect_id": item.defect_id,
                "defect_name": item.defect.name if item.defect else None,
                "defect_code": item.defect.code if item.defect else None,
                "count": item.defect_count,
                "severity": item.severity,
            }
        ]
        return {
            "id": str(item.id),
            "hour": item.hour,
            "batch_size": item.batch_size,
            "item_date": str(item.item_date) if item.item_date else None,
            "operation": item.operation,
            "corrective_action": item.corrective_action,
            "remarks": item.remarks,
            "defects": defects,
        }

    if not is_admin and str(report.created_by) != str(current_user.id) and str(report.auditor_id) != str(current_user.id):
        raise HTTPException(403, "You do not have permission to access this report.")

    return success_response(data={
        "id": str(report.id),
        "header": {
            "report_type":       report.report_type,
            "vendor_name":       report.vendor.name if report.vendor else None,
            "floor_name":        report.floor.name if report.floor else None,
            "line_name":         report.line.name if report.line else None,
            "order_no":          report.order.order_no if report.order else None,
            "style_name":        report.order.style_name if report.order else None,
            "inspection_date":   str(report.inspection_date),
            "shift":             report.shift,
            "auditor_name":      report.auditor_name,
            "auditor_code":      report.auditor_code,
            "quantity_checked":  report.quantity_checked,
            "quantity_passed":   report.quantity_passed,
            "quantity_rejected": report.quantity_rejected,
            "dhu_percent":       report.dhu_percent,
            "fpy_percent":       report.fpy_percent,
            "total_defects":     report.total_defects,
            "status":            report.status,
            "remarks":           report.remarks,
            "article_code":      report.article_code.code if report.article_code else None,
            "article_name":      report.article_code.name if report.article_code else None,
            "product_color":     report.product_color.color_name if report.product_color else None,
            "color_hex":         report.product_color.color_hex if report.product_color else None,
        },
        "items": [_item_out(i) for i in report.items],
        "attachments": [
            {
                "id":          str(a.id),
                "file_name":   a.file_name,
                "mime_type":   a.mime_type,
                "file_size":   a.file_size,
                "uploaded_at": str(a.uploaded_at),
            }
            for a in report.attachments
        ],
    })


# ─── Attachments ──────────────────────────────────────────────────────────────

ALLOWED_MIME_PREFIXES = (
    "image/", "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument",
    "application/vnd.ms-excel",
    "text/plain",
)

@router.post("/{report_id}/attachments", summary="Upload attachment to QC report")
async def upload_attachment(
    report_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(QCAccess),
):
    # Accept attachments for any report type (standard qc_reports_v2 or advanced-qc tables)
    # We don't restrict to qc_reports_v2 so that inline, cut-panel, batch-audit,
    # and finish-endline reports can also have file attachments.

    # Basic mime validation
    mime = file.content_type or ""
    if not any(mime.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        raise HTTPException(400, f"File type '{mime}' is not allowed.")

    ext      = os.path.splitext(file.filename or "file")[1].lower()
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(QC_ATTACHMENTS_DIR, filename)

    with open(filepath, "wb") as buf:
        shutil.copyfileobj(file.file, buf)

    file_size = os.path.getsize(filepath)

    attachment = QCReportAttachment(
        report_id=report_id,
        file_name=file.filename,
        file_path=filepath,
        mime_type=mime,
        file_size=file_size,
        uploaded_by=str(current_user.id),
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return success_response(
        data={"id": str(attachment.id), "file_name": attachment.file_name},
        message="Attachment uploaded."
    )


@router.get("/{report_id}/attachments/{attachment_id}/download", summary="Download attachment")
def download_attachment(
    report_id: str,
    attachment_id: str,
    db: Session = Depends(get_db),
    _=Depends(QCAccess),
):
    att = db.query(QCReportAttachment).filter(
        QCReportAttachment.id == attachment_id,
        QCReportAttachment.report_id == report_id,
    ).first()
    if not att:
        raise HTTPException(404, "Attachment not found.")
    if not os.path.exists(att.file_path):
        raise HTTPException(410, "File no longer exists on server.")
    return FileResponse(
        path=att.file_path,
        filename=att.file_name,
        media_type=att.mime_type or "application/octet-stream",
    )


@router.delete("/{report_id}/attachments/{attachment_id}", summary="Delete attachment")
def delete_attachment(
    report_id: str,
    attachment_id: str,
    db: Session = Depends(get_db),
    _=Depends(QCAccess),
):
    att = db.query(QCReportAttachment).filter(
        QCReportAttachment.id == attachment_id,
        QCReportAttachment.report_id == report_id,
    ).first()
    if not att:
        raise HTTPException(404, "Attachment not found.")
    if os.path.exists(att.file_path):
        os.remove(att.file_path)
    db.delete(att)
    db.commit()
    return success_response(message="Attachment deleted.")


# ─── Operator Flags (Track 2) ─────────────────────────────────────────────────

@router.get("/operator-flags", summary="List operator flags for a line")
def list_operator_flags(
    line_id: str = Query(...),
    db: Session = Depends(get_db),
    _=Depends(QCAccess),
):
    flags = db.query(OperatorFlag).filter(OperatorFlag.line_id == line_id).order_by(OperatorFlag.operator_number).all()
    return success_response(data=[
        {
            "id":               str(f.id),
            "operator_number":  f.operator_number,
            "operator_name":    f.operator_name,
            "flag_color":       f.flag_color,
            "defect_id":        f.defect_id,
            "defect_name":      f.defect.name if f.defect else None,
            "defect_code":      f.defect.code if f.defect else None,
            "note":             f.note,
            "corrective_action": f.corrective_action,
            "flagged_at":       str(f.flagged_at),
            "updated_at":       str(f.updated_at),
            "history": [
                {
                    "old_color":  h.old_color,
                    "new_color":  h.new_color,
                    "changed_at": str(h.changed_at),
                    "note":       h.note,
                }
                for h in f.history
            ],
        }
        for f in flags
    ])


@router.post("/operator-flags", summary="Create or update an operator flag")
def upsert_operator_flag(
    payload: OperatorFlagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(QCAccess),
):
    # Check if a flag already exists for this operator on this line
    existing = db.query(OperatorFlag).filter(
        OperatorFlag.line_id == payload.line_id,
        OperatorFlag.operator_number == payload.operator_number,
    ).first()

    if existing:
        old_color = existing.flag_color
        for k, v in payload.model_dump(exclude_none=True).items():
            setattr(existing, k, v)
        # Log the history if color changed
        if old_color != payload.flag_color:
            hist = OperatorFlagHistory(
                operator_flag_id=str(existing.id),
                old_color=old_color,
                new_color=payload.flag_color,
                changed_by=str(current_user.id),
                note=payload.note,
            )
            db.add(hist)
        db.commit()
        db.refresh(existing)
        return success_response(data={"id": str(existing.id)}, message="Flag updated.")
    else:
        flag = OperatorFlag(**payload.model_dump(), flagged_by=str(current_user.id))
        db.add(flag)
        db.flush()
        # Initial history entry
        hist = OperatorFlagHistory(
            operator_flag_id=str(flag.id),
            old_color=None,
            new_color=payload.flag_color,
            changed_by=str(current_user.id),
        )
        db.add(hist)
        db.commit()
        db.refresh(flag)
        return success_response(data={"id": str(flag.id)}, message="Flag created.")


@router.put("/operator-flags/{flag_id}", summary="Update an operator flag")
def update_operator_flag(
    flag_id: str,
    payload: OperatorFlagUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(QCAccess),
):
    flag = db.query(OperatorFlag).filter(OperatorFlag.id == flag_id).first()
    if not flag:
        raise HTTPException(404, "Flag not found.")

    old_color = flag.flag_color
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(flag, k, v)

    if payload.flag_color and old_color != payload.flag_color:
        hist = OperatorFlagHistory(
            operator_flag_id=flag_id,
            old_color=old_color,
            new_color=payload.flag_color,
            changed_by=str(current_user.id),
            note=payload.note,
        )
        db.add(hist)

    db.commit()
    return success_response(message="Flag updated.")


@router.delete("/operator-flags/{flag_id}", summary="Remove an operator flag (reset to green)")
def delete_operator_flag(
    flag_id: str,
    db: Session = Depends(get_db),
    _=Depends(ManagerAccess),
):
    flag = db.query(OperatorFlag).filter(OperatorFlag.id == flag_id).first()
    if not flag:
        raise HTTPException(404, "Flag not found.")
    db.delete(flag)
    db.commit()
    return success_response(message="Flag removed.")
