"""
Analytics API — endpoints for dashboard data and performance reports.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import joinedload
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import RoleEnum
from app.models.order import (
    Order,
    OrderProductionAssignment,
    OrderStatus,
    ProductionStage,
    StageStatus,
    VendorFloor,
    VendorLine,
    VendorDepartment,
)
from app.services.analytics_service import AnalyticsService
from app.utils.response import success_response

router = APIRouter(prefix="/analytics", tags=["Analytics"])

AnalyticsAccess = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager, RoleEnum.qc_officer, RoleEnum.viewer])

@router.get("/dashboard-summary", response_model=dict, summary="Get Dashboard Summary")
def get_dashboard_summary(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(AnalyticsAccess),
):
    summary = AnalyticsService.get_dashboard_summary(db, date_from, date_to)
    return success_response(data=summary)

@router.get("/top-defects", response_model=dict, summary="Get Top Defects")
def get_top_defects(
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    _=Depends(AnalyticsAccess),
):
    defects = AnalyticsService.get_top_defects(db, limit)
    return success_response(data=defects)

@router.get("/line-quality", response_model=dict, summary="Get Line-wise Quality")
def get_line_quality(
    db: Session = Depends(get_db),
    _=Depends(AnalyticsAccess),
):
    quality = AnalyticsService.get_line_wise_quality(db)
    return success_response(data=quality)


def _value(value):
    return value.value if hasattr(value, "value") else value


def _label(value: str | None) -> str:
    if not value:
        return "Not Started"
    return value.replace("_", " ").replace("/", " / ").title()


def _current_stage(stages: list[ProductionStage]) -> dict:
    if not stages:
        return {
            "stage_name": "not_started",
            "stage_label": "Not Started",
            "stage_status": "pending",
            "progress_percent": 0,
        }

    ordered = sorted(stages, key=lambda stage: stage.stage_order or 0)
    required = [stage for stage in ordered if stage.is_required]
    stage_pool = required or ordered
    completed = [
        stage for stage in stage_pool
        if stage.status == StageStatus.completed or _value(stage.status) == "completed"
    ]
    active = next(
        (
            stage for stage in stage_pool
            if stage.status == StageStatus.in_progress or _value(stage.status) == "in_progress"
        ),
        None,
    )
    current = active or next(
        (
            stage for stage in stage_pool
            if stage.status not in (StageStatus.completed, StageStatus.skipped)
            and _value(stage.status) not in ("completed", "skipped")
        ),
        None,
    )
    if not current:
        current = stage_pool[-1]

    progress = round((len(completed) / len(stage_pool)) * 100) if stage_pool else 0
    return {
        "stage_name": _value(current.stage_name),
        "stage_label": _label(_value(current.stage_name)),
        "stage_status": _value(current.status),
        "progress_percent": progress,
    }


@router.get("/order-tracking", response_model=dict, summary="Vendor/Floor/Line Order Tracking Dashboard")
def get_order_tracking(
    track_type: Optional[str] = Query(None),
    vendor_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(AnalyticsAccess),
):
    orders_q = db.query(Order).options(
        joinedload(Order.vendor),
        joinedload(Order.sample_class),
        joinedload(Order.bulk_class),
        joinedload(Order.stages),
        joinedload(Order.assignments),
    ).filter(Order.is_active == True)

    if track_type and track_type != "all":
        orders_q = orders_q.filter(Order.track_type == track_type)
    if vendor_id:
        orders_q = orders_q.filter(Order.vendor_id == vendor_id)

    orders = orders_q.order_by(Order.created_at.desc()).all()
    floors = {str(floor.id): floor for floor in db.query(VendorFloor).all()}
    lines = {str(line.id): line for line in db.query(VendorLine).all()}
    departments = {str(department.id): department for department in db.query(VendorDepartment).all()}

    vendor_map: dict[str, dict] = {}
    summary = {
        "total_orders": 0,
        "bulk_orders": 0,
        "sample_orders": 0,
        "delayed_orders": 0,
        "completed_orders": 0,
        "in_progress_orders": 0,
    }

    def ensure_vendor(order: Order) -> dict:
        vid = str(order.vendor_id)
        if vid not in vendor_map:
            vendor_map[vid] = {
                "vendor_id": vid,
                "vendor_name": order.vendor.name if order.vendor else "Unknown Vendor",
                "total_orders": 0,
                "bulk_orders": 0,
                "sample_orders": 0,
                "delayed_orders": 0,
                "floors": {},
            }
        return vendor_map[vid]

    def ensure_floor(vendor: dict, floor_id: str | None, floor_name: str) -> dict:
        key = floor_id or "unassigned-floor"
        if key not in vendor["floors"]:
            vendor["floors"][key] = {
                "floor_id": floor_id,
                "floor_name": floor_name,
                "total_orders": 0,
                "lines": {},
            }
        return vendor["floors"][key]

    def ensure_line(floor: dict, line_id: str | None, line_name: str) -> dict:
        key = line_id or line_name.lower().replace(" ", "-")
        if key not in floor["lines"]:
            floor["lines"][key] = {
                "line_id": line_id,
                "line_name": line_name,
                "orders": [],
                "total_orders": 0,
                "bulk_orders": 0,
                "sample_orders": 0,
            }
        return floor["lines"][key]

    for order in orders:
        stage = _current_stage(list(order.stages or []))
        track = _value(order.track_type)
        status = _value(order.status)
        is_delayed = bool(order.delay_days)
        class_name = order.bulk_class.name if track == "bulk" and order.bulk_class else None
        class_name = class_name or (order.sample_class.name if track == "sampling" and order.sample_class else None)

        order_out = {
            "order_id": str(order.id),
            "order_no": order.order_no,
            "product_name": order.product_name,
            "style_name": order.style_name,
            "quantity": order.quantity,
            "track_type": track,
            "class_id": str(order.bulk_class_id or order.sample_class_id) if (order.bulk_class_id or order.sample_class_id) else None,
            "class_name": class_name or "No Class",
            "order_status": status,
            "priority": _value(order.priority),
            "ex_factory_date": str(order.ex_factory_date) if order.ex_factory_date else None,
            "is_delayed": is_delayed,
            "delay_days": order.delay_days,
            **stage,
        }

        summary["total_orders"] += 1
        summary["bulk_orders"] += 1 if track == "bulk" else 0
        summary["sample_orders"] += 1 if track == "sampling" else 0
        summary["delayed_orders"] += 1 if is_delayed else 0
        summary["completed_orders"] += 1 if status == OrderStatus.completed.value else 0
        summary["in_progress_orders"] += 1 if status == OrderStatus.in_progress.value else 0

        vendor = ensure_vendor(order)
        vendor["total_orders"] += 1
        vendor["bulk_orders"] += 1 if track == "bulk" else 0
        vendor["sample_orders"] += 1 if track == "sampling" else 0
        vendor["delayed_orders"] += 1 if is_delayed else 0

        assignments = list(order.assignments or [])
        if not assignments:
            assignments = [OrderProductionAssignment(floor_id=None, line_id=None)]

        for assignment in assignments:
            department_obj = departments.get(str(assignment.department_id)) if getattr(assignment, "department_id", None) else None
            if track == "sampling":
                floor_id = str(assignment.department_id) if getattr(assignment, "department_id", None) else None
                floor_name = department_obj.name if department_obj else "Sampling Department"
                line_id = None
                line_name = "Sample Orders"
            else:
                floor_obj = floors.get(str(assignment.floor_id)) if assignment.floor_id else None
                line_obj = lines.get(str(assignment.line_id)) if assignment.line_id else None
                floor_id = str(assignment.floor_id) if assignment.floor_id else None
                line_id = str(assignment.line_id) if assignment.line_id else None
                floor_name = floor_obj.name if floor_obj else "Unassigned Floor"
                line_name = line_obj.name if line_obj else ("Full Floor" if assignment.floor_id else "Unassigned Line")
            floor = ensure_floor(vendor, floor_id, floor_name)
            line = ensure_line(floor, line_id, line_name)
            floor["total_orders"] += 1
            line["total_orders"] += 1
            line["bulk_orders"] += 1 if track == "bulk" else 0
            line["sample_orders"] += 1 if track == "sampling" else 0
            line["orders"].append(order_out)

    data = []
    for vendor in vendor_map.values():
        floors_out = []
        for floor in vendor["floors"].values():
            floor["lines"] = sorted(floor["lines"].values(), key=lambda line: line["line_name"])
            floors_out.append(floor)
        vendor["floors"] = sorted(floors_out, key=lambda floor: floor["floor_name"])
        data.append(vendor)

    return success_response(data={
        "summary": summary,
        "vendors": sorted(data, key=lambda vendor: vendor["vendor_name"]),
    })
