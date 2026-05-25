"""
QC Service V2 — Business logic for quality inspections.
Handles KPI calculations (DHU%, FPY%) and multi-defect item saving.
"""
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.repositories.qc_report_repo import QCReportRepository, DefectMasterRepository
from app.schemas.qc_report import QCReportCreate, AnalyticsSummary
from app.models.qc_report import (
    QCReport, QCReportItem, QCReportItemDefect,
    ReportStatus, DefectSeverity, DefectCode
)


class QCService:

    @staticmethod
    def create_report(db: Session, payload: QCReportCreate, user_id: str) -> QCReport:
        report_dict = payload.model_dump(exclude={"items"})

        # ── Tally defects from all items (multi-defect aware) ──────────────
        total_defects = 0
        crit = maj = min_c = 0

        for item in payload.items:
            # Multi-defect entries take precedence
            if item.defect_entries:
                for entry in item.defect_entries:
                    total_defects += entry.defect_count
                    sev = entry.severity
                    if not sev:
                        df = db.query(DefectCode).filter(DefectCode.id == entry.defect_id).first()
                        sev = df.severity if df else DefectSeverity.major
                    if sev == DefectSeverity.critical: crit += entry.defect_count
                    elif sev == DefectSeverity.major:   maj  += entry.defect_count
                    else:                               min_c += entry.defect_count
            elif item.defect_id:
                # Legacy single-defect path
                total_defects += item.defect_count
                sev = item.severity
                if not sev:
                    df = db.query(DefectCode).filter(DefectCode.id == item.defect_id).first()
                    sev = df.severity if df else DefectSeverity.major
                if sev == DefectSeverity.critical: crit += item.defect_count
                elif sev == DefectSeverity.major:   maj  += item.defect_count
                else:                               min_c += item.defect_count

        # ── KPI calculations ───────────────────────────────────────────────
        checked  = payload.quantity_checked
        passed   = payload.quantity_passed
        rejected = payload.quantity_rejected

        dhu      = (total_defects / checked * 100) if checked > 0 else 0
        fpy      = (passed / checked * 100)        if checked > 0 else 0
        pass_p   = (passed / checked * 100)        if checked > 0 else 0
        reject_p = (rejected / checked * 100)      if checked > 0 else 0

        report_dict.update({
            "total_defects":   total_defects,
            "critical_count":  crit,
            "major_count":     maj,
            "minor_count":     min_c,
            "dhu_percent":     round(dhu, 2),
            "fpy_percent":     round(fpy, 2),
            "pass_percent":    round(pass_p, 2),
            "reject_percent":  round(reject_p, 2),
            "status":          ReportStatus.submitted,
            "created_by":      user_id,
        })

        report = QCReportRepository.create(db, report_dict)

        # ── Save items with multi-defect children ─────────────────────────
        for item in payload.items:
            item_dict = item.model_dump(exclude={"defect_entries"})
            db_item = QCReportItem(report_id=str(report.id), **item_dict)
            db.add(db_item)
            db.flush()   # get db_item.id before adding children

            # Save multi-defect entries
            for entry in item.defect_entries:
                sev = entry.severity
                if not sev:
                    df = db.query(DefectCode).filter(DefectCode.id == entry.defect_id).first()
                    sev = df.severity if df else DefectSeverity.major
                db_entry = QCReportItemDefect(
                    item_id=str(db_item.id),
                    defect_id=entry.defect_id,
                    defect_count=entry.defect_count,
                    severity=sev,
                )
                db.add(db_entry)

        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def get_analytics(db: Session) -> AnalyticsSummary:
        return QCReportRepository.get_analytics(db)

    @staticmethod
    def list_reports(
        db: Session,
        vendor_id: Optional[str] = None,
        report_type: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[QCReport]:
        return QCReportRepository.get_all(
            db, vendor_id=vendor_id, report_type=report_type,
            status=status, skip=skip, limit=limit
        )

    @staticmethod
    def get_report(db: Session, report_id: str) -> QCReport:
        report = QCReportRepository.get_by_id(db, report_id)
        if not report:
            raise HTTPException(status_code=404, detail="QC Report not found.")
        return report

    @staticmethod
    def approve_report(db: Session, report_id: str, user_id: str) -> QCReport:
        report = QCReportRepository.get_by_id(db, report_id)
        if not report:
            raise HTTPException(404, "Report not found.")
        report.status = ReportStatus.approved
        db.commit()
        return report

    @staticmethod
    def reject_report(db: Session, report_id: str, user_id: str) -> QCReport:
        report = QCReportRepository.get_by_id(db, report_id)
        if not report:
            raise HTTPException(404, "Report not found.")
        report.status = ReportStatus.rejected
        db.commit()
        return report


class DefectMasterService:

    @staticmethod
    def seed_default_defects(db: Session):
        """Helper to seed initial industrial defects if tables are empty."""
        pass
