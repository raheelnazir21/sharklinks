"""
Analytics Service — handles all KPI calculations and data aggregation.
DHU % = (Total Defects / Total Pieces Checked) * 100
FPY % = (Pass Pieces / Total Pieces Checked) * 100
"""
from typing import List, Optional, Dict, Any
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.qc_report import QCReport, QCReportItem, ReportStatus
from app.models.order import Order, OrderStatus

class AnalyticsService:

    @staticmethod
    def get_dashboard_summary(db: Session, date_from: Optional[date] = None, date_to: Optional[date] = None) -> Dict[str, Any]:
        query = db.query(QCReport).filter(QCReport.status == ReportStatus.approved)
        
        if date_from:
            query = query.filter(QCReport.inspection_date >= date_from)
        if date_to:
            query = query.filter(QCReport.inspection_date <= date_to)
            
        reports = query.all()
        
        total_pieces = sum(r.quantity_checked for r in reports)
        pass_pieces = sum(r.quantity_passed for r in reports)
        fail_pieces = sum(r.quantity_rejected for r in reports)
        
        # Calculate total defects from all report items
        total_defects = db.query(func.sum(QCReportItem.defect_count)).join(QCReport).filter(
            QCReport.status == ReportStatus.approved
        )
        if date_from:
            total_defects = total_defects.filter(QCReport.inspection_date >= date_from)
        if date_to:
            total_defects = total_defects.filter(QCReport.inspection_date <= date_to)
        
        total_defects_count = total_defects.scalar() or 0
        
        dhu = round((total_defects_count / total_pieces) * 100, 2) if total_pieces > 0 else 0.0
        fpy = round((pass_pieces / total_pieces) * 100, 2) if total_pieces > 0 else 0.0
        rejection_rate = round((fail_pieces / total_pieces) * 100, 2) if total_pieces > 0 else 0.0
        
        # Pending approvals
        pending_count = db.query(func.count(QCReport.id)).filter(QCReport.status == ReportStatus.submitted).scalar()
        
        # On-time delivery calculation
        completed_orders = db.query(Order).filter(
            Order.status == OrderStatus.completed,
            Order.is_active == True,
        ).all()
        on_time_count = sum(
            1 for o in completed_orders 
            if o.ex_factory_date and (getattr(o, "created_at", None) and o.created_at.date() <= o.ex_factory_date)
        )
        on_time_rate = round((on_time_count / len(completed_orders)) * 100, 2) if completed_orders else 0.0

        return {
            "overall_pass_rate": fpy,
            "total_inspections": len(reports),
            "total_rejections": fail_pieces,
            "rejection_rate": rejection_rate,
            "dhu_percent": dhu,
            "fpy_percent": fpy,
            "on_time_rate": on_time_rate,
            "pending_approvals": pending_count
        }

    @staticmethod
    def get_top_defects(db: Session, limit: int = 5) -> List[Dict[str, Any]]:
        from app.models.qc_report import DefectCode
        
        results = db.query(
            DefectCode.code,
            DefectCode.name,
            func.sum(QCReportItem.defect_count).label("total_quantity")
        ).join(QCReportItem).join(QCReport).filter(
            QCReport.status == ReportStatus.approved
        ).group_by(DefectCode.id).order_by(func.sum(QCReportItem.defect_count).desc()).limit(limit).all()
        
        return [{"code": r[0], "name": r[1], "count": r[2]} for r in results]

    @staticmethod
    def get_line_wise_quality(db: Session) -> List[Dict[str, Any]]:
        from app.models.order import VendorLine
        results = db.query(
            VendorLine.name,
            func.avg(QCReport.fpy_percent).label("avg_fpy"),
            func.avg(QCReport.dhu_percent).label("avg_dhu")
        ).join(QCReport, QCReport.line_id == VendorLine.id).filter(
            QCReport.status == ReportStatus.approved
        ).group_by(VendorLine.id).all()
        
        return [{"line_name": r[0], "fpy": round(r[1], 2), "dhu": round(r[2], 2)} for r in results if r[0]]
