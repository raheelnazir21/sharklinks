"""
Reports/Exports API — endpoints for downloading PDF and Excel reports.
"""
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import RoleEnum
from app.services.pdf_service import PDFService
from app.services.excel_service import ExcelService
from app.services.qc_service import QCService

router = APIRouter(prefix="/reports", tags=["Reports & Exports"])

ReportAccess = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager, RoleEnum.viewer])

@router.get("/{report_id}/export/pdf", summary="Export QC Report to PDF")
def export_pdf(
    report_id: str,
    db: Session = Depends(get_db),
    _=Depends(ReportAccess),
):
    report = QCService.get_report(db, report_id)
    pdf_buffer = PDFService.generate_qc_report_pdf(report)
    
    filename = f"QC_Report_{report.report_type.value}_{report_id[:8]}.pdf"
    
    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/export/excel", summary="Export QC Reports to Excel")
def export_excel(
    order_id: Optional[str] = Query(None),
    report_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(ReportAccess),
):
    reports = QCService.list_reports(db, order_id=order_id, report_type=report_type, status=status, skip=0, limit=1000)
    excel_buffer = ExcelService.generate_qc_reports_excel(reports)
    
    filename = f"QC_Reports_Export_{date.today()}.xlsx"
    
    return Response(
        content=excel_buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
