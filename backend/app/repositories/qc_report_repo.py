"""
QC Report Repository V2 — Handles DB operations for the new enterprise QC system.
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.qc_report import QCReport, QCReportItem, DefectCode, DefectCategory, ReportStatus, QCReportType


class QCReportRepository:

    @staticmethod
    def get_all(
        db: Session,
        vendor_id: Optional[str] = None,
        report_type: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
        user_id: Optional[str] = None,
    ) -> List[QCReport]:
        q = db.query(QCReport)
        if vendor_id:
            q = q.filter(QCReport.vendor_id == vendor_id)
        if report_type:
            q = q.filter(QCReport.report_type == report_type)
        if status:
            q = q.filter(QCReport.status == status)
        if user_id:
            q = q.filter((QCReport.created_by == user_id) | (QCReport.auditor_id == user_id))
        return q.order_by(QCReport.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_by_id(db: Session, report_id: str) -> Optional[QCReport]:
        return db.query(QCReport).filter(QCReport.id == report_id).first()

    @staticmethod
    def create(db: Session, data: dict) -> QCReport:
        report = QCReport(**data)
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def add_items(db: Session, report_id: str, items: List[dict]):
        for item_data in items:
            item = QCReportItem(report_id=report_id, **item_data)
            db.add(item)
        db.commit()

    @staticmethod
    def get_analytics(db: Session):
        from app.models.qc_report import QCReportItemDefect
        # Basic summary stats
        total_reports = db.query(func.count(QCReport.id)).scalar()
        total_defects = db.query(func.sum(QCReport.total_defects)).scalar() or 0
        avg_dhu = db.query(func.avg(QCReport.dhu_percent)).scalar() or 0.0
        avg_fpy = db.query(func.avg(QCReport.fpy_percent)).scalar() or 0.0
        
        # Top 5 Defects (Now from the multi-defect table)
        top_defects = db.query(
            DefectCode.name, func.sum(QCReportItemDefect.defect_count).label("count")
        ).join(QCReportItemDefect, QCReportItemDefect.defect_id == DefectCode.id)\
         .group_by(DefectCode.name)\
         .order_by(func.sum(QCReportItemDefect.defect_count).desc())\
         .limit(5).all()

        return {
            "total_inspections": total_reports,
            "total_defects": total_defects,
            "avg_dhu": round(avg_dhu, 2),
            "avg_fpy": round(avg_fpy, 2),
            "top_defects": [{"name": d[0], "count": d[1]} for d in top_defects],
            "line_performance": [], 
            "vendor_performance": []
        }

    @staticmethod
    def get_flattened_logs(
        db: Session,
        vendor_id: Optional[str] = None,
        report_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
        user_id: Optional[str] = None,
    ):
        q = db.query(QCReportItem).join(QCReport)
        if vendor_id:
            q = q.filter(QCReport.vendor_id == vendor_id)
        if report_type:
            q = q.filter(QCReport.report_type == report_type)
        if user_id:
            q = q.filter((QCReport.created_by == user_id) | (QCReport.auditor_id == user_id))
            
        total = q.count()
        # Ensure we load defect_entries for the frontend
        items = q.order_by(QCReport.inspection_date.desc()).offset(skip).limit(limit).all()
        
        return items, total


class DefectMasterRepository:

    @staticmethod
    def get_categories(db: Session, report_type: Optional[QCReportType] = None):
        q = db.query(DefectCategory).filter(DefectCategory.status == True)
        if report_type:
            q = q.filter(DefectCategory.report_type == report_type)
        return q.all()

    @staticmethod
    def create_category(db: Session, data: dict):
        cat = DefectCategory(**data)
        db.add(cat)
        db.commit()
        db.refresh(cat)
        return cat

    @staticmethod
    def get_defects(db: Session, report_type: Optional[QCReportType] = None, category_id: Optional[int] = None):
        q = db.query(DefectCode).filter(DefectCode.status == True)
        if report_type:
            q = q.filter(DefectCode.report_type == report_type)
        if category_id:
            q = q.filter(DefectCode.category_id == category_id)
        return q.all()

    @staticmethod
    def create_defect(db: Session, data: dict):
        df = DefectCode(**data)
        db.add(df)
        db.commit()
        db.refresh(df)
        return df
