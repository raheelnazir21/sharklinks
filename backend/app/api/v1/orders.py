"""
Orders & Production Stages API.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import String, cast
from sqlalchemy.orm import Session
from typing import Optional
import shutil, os, uuid
import json

from app.core.database import get_db
from app.core.dependencies import require_roles, get_current_user
from app.core.access_control import assert_vendor_access, is_admin_user, scoped_vendor_query
from app.models.audit_log import AuditLog
from app.models.user import RoleEnum, User
from app.models.order import Attachment, TrackType, OrderHistory, Order, OrderStatus
from app.services.order_service import OrderService, StageService
from app.services.activity_log_service import ActivityLogService
from app.repositories.order_repo import SampleClassRepository, BulkClassRepository, _id_variants
from app.schemas.order import (
    OrderCreate, OrderUpdate, StageCreate, StageUpdate, 
    SampleClassCreate, SampleClassUpdate, BulkClassCreate, BulkClassUpdate, BulkOrderCreate,
    StageReworkRequest
)
from app.utils.response import success_response

router = APIRouter(prefix="/orders", tags=["Orders"])

AllStaff = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager, RoleEnum.qc_officer])
ManagerAccess = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager])

UPLOAD_DIR = "uploads/attachments"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _is_admin_user(user: User) -> bool:
    return is_admin_user(user)


def _allowed_vendor_ids(db: Session, user: User) -> Optional[list[str]]:
    if _is_admin_user(user):
        return None
    return [str(vendor.id) for vendor in scoped_vendor_query(db, user).all()]


def _assert_order_access(db: Session, order_id: str, user: User) -> Order:
    order = OrderService.get_order(db, order_id)
    if _is_admin_user(user):
        return order
    if order.vendor_id and str(order.vendor_id) in (_allowed_vendor_ids(db, user) or []):
        return order
    raise HTTPException(status_code=403, detail="You can only access orders for your assigned vendors.")


def _assert_stage_order_access(db: Session, stage_id: str, user: User) -> Order:
    stage = StageService.get_stage(db, stage_id)
    return _assert_order_access(db, str(stage.order_id), user)


# ─── Project Container Endpoints (Static Routes First) ──────────────────────

@router.get("/sample-classes", summary="List Sample Classes")
def list_sample_classes(
    vendor_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(AllStaff),
):
    if vendor_id:
        assert_vendor_access(db, vendor_id, current_user)
    scs = SampleClassRepository.get_all(db, vendor_id, allowed_vendor_ids=_allowed_vendor_ids(db, current_user))
    return success_response(data=[{
        "id": str(s.id), "name": s.name, "serial_number": s.serial_number,
        "customer": s.customer, "status": s.status, "remarks": s.remarks,
        "vendor_id": str(s.vendor_id) if s.vendor_id else None,
        "vendor_name": s.vendor.name if s.vendor else None,
        "created_at": s.created_at.isoformat()
    } for s in scs])


@router.post("/sample-classes", summary="Create Sample Class")
def create_sample_class(
    payload: SampleClassCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(ManagerAccess),
):
    if payload.vendor_id:
        assert_vendor_access(db, payload.vendor_id, current_user)
    data = payload.model_dump()
    data["created_by"] = str(current_user.id)
    sc = SampleClassRepository.create(db, data)
    ActivityLogService.record(
        db,
        action="SAMPLE_PROJECT_CREATED",
        entity_type="Order",
        entity_id=str(sc.id),
        user=current_user,
        payload={"details": f"Sample project '{sc.name}' was created."},
    )
    return success_response(data={"id": str(sc.id)}, message="Sample Class created.")


@router.put("/sample-classes/{sample_class_id}", summary="Update Sample Class")
def update_sample_class(
    sample_class_id: str,
    payload: SampleClassUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(ManagerAccess),
):
    sc = SampleClassRepository.get_by_id(db, sample_class_id)
    if not sc:
        from fastapi import HTTPException
        raise HTTPException(404, "Sample Class not found.")
    if sc.vendor_id:
        assert_vendor_access(db, str(sc.vendor_id), current_user)
    if payload.vendor_id:
        assert_vendor_access(db, payload.vendor_id, current_user)
    old_value = {
        "name": sc.name,
        "serial_number": sc.serial_number,
        "customer": sc.customer,
        "vendor_id": str(sc.vendor_id) if sc.vendor_id else None,
        "status": sc.status,
        "remarks": sc.remarks,
    }
    updated = SampleClassRepository.update(db, sc, payload.model_dump(exclude_none=True))
    ActivityLogService.record(
        db,
        action="SAMPLE_PROJECT_UPDATED",
        entity_type="Order",
        entity_id=str(updated.id),
        user=current_user,
        payload={"details": f"Sample project '{updated.name}' was updated.", "old": old_value, "new": payload.model_dump(exclude_none=True)},
    )
    return success_response(data={"id": str(updated.id)}, message="Sample Class updated.")


@router.delete("/sample-classes/{sample_class_id}", summary="Deactivate Sample Class")
def delete_sample_class(
    sample_class_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(AllStaff),
):
    sc = SampleClassRepository.get_by_id(db, sample_class_id)
    if not sc:
        from fastapi import HTTPException
        raise HTTPException(404, "Sample Class not found.")
    if sc.vendor_id:
        assert_vendor_access(db, str(sc.vendor_id), current_user)
    sc.status = "inactive"
    affected_orders = db.query(Order).filter(
        cast(Order.sample_class_id, String).in_(_id_variants(str(sc.id))),
        Order.is_active == True,
    ).all()
    for order in affected_orders:
        order.status = OrderStatus.cancelled
        order.is_active = False
    db.commit()
    ActivityLogService.record(
        db,
        action="SAMPLE_PROJECT_DEACTIVATED",
        entity_type="Order",
        entity_id=str(sc.id),
        user=current_user,
        payload={"details": f"Sample project '{sc.name}' was deactivated with {len(affected_orders)} active order(s)."},
    )
    return success_response(message="Sample Class and related active orders deactivated.")


@router.get("/bulk-classes", response_model=dict, summary="List Bulk Projects")
def list_bulk_classes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(AllStaff),
):
    allowed_vendor_ids = _allowed_vendor_ids(db, current_user)
    classes = OrderService.list_bulk_classes(
        db,
        created_by=None if _is_admin_user(current_user) else str(current_user.id),
        allowed_vendor_ids=allowed_vendor_ids,
    )
    return success_response(data=[{
        "id": str(bc.id),
        "name": bc.name,
        "serial_number": bc.serial_number,
        "customer": bc.customer,
        "status": bc.status,
        "vendor_names": sorted({order.vendor.name for order in bc.orders if order.is_active and order.vendor}),
        "created_at": bc.created_at.isoformat(),
    } for bc in classes])


@router.post("/bulk-classes", response_model=dict, summary="Create Bulk Project")
def create_bulk_class(
    payload: BulkClassCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(ManagerAccess),
):
    bc = OrderService.create_bulk_class(db, payload, str(current_user.id))
    ActivityLogService.record(
        db,
        action="BULK_PROJECT_CREATED",
        entity_type="Order",
        entity_id=str(bc.id),
        user=current_user,
        payload={"details": f"Bulk project '{bc.name}' was created."},
    )
    return success_response(data={"id": str(bc.id), "name": bc.name})


@router.put("/bulk-classes/{bc_id}", response_model=dict, summary="Update Bulk Project")
def update_bulk_class(
    bc_id: str,
    payload: BulkClassUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(ManagerAccess),
):
    bc = BulkClassRepository.get_by_id(db, bc_id)
    if not bc:
        from fastapi import HTTPException
        raise HTTPException(404, "Bulk Project not found.")
    if not _is_admin_user(current_user) and str(bc.created_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only update your own bulk projects.")
    old_value = {
        "name": bc.name,
        "serial_number": bc.serial_number,
        "customer": bc.customer,
        "status": bc.status,
        "remarks": bc.remarks,
    }
    updated = BulkClassRepository.update(db, bc, payload.model_dump(exclude_none=True))
    ActivityLogService.record(
        db,
        action="BULK_PROJECT_UPDATED",
        entity_type="Order",
        entity_id=str(updated.id),
        user=current_user,
        payload={"details": f"Bulk project '{updated.name}' was updated.", "old": old_value, "new": payload.model_dump(exclude_none=True)},
    )
    return success_response(data={"id": str(updated.id), "name": updated.name}, message="Bulk Project updated.")


@router.delete("/bulk-classes/{bc_id}", response_model=dict, summary="Deactivate Bulk Project")
def delete_bulk_class(
    bc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(AllStaff),
):
    bc = BulkClassRepository.get_by_id(db, bc_id)
    if not bc:
        from fastapi import HTTPException
        raise HTTPException(404, "Bulk Project not found.")
    if not _is_admin_user(current_user) and str(bc.created_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only deactivate your own bulk projects.")
    bc.status = "inactive"
    affected_orders = db.query(Order).filter(
        cast(Order.bulk_class_id, String).in_(_id_variants(str(bc.id))),
        Order.is_active == True,
    ).all()
    for order in affected_orders:
        order.status = OrderStatus.cancelled
        order.is_active = False
    db.commit()
    ActivityLogService.record(
        db,
        action="BULK_PROJECT_DEACTIVATED",
        entity_type="Order",
        entity_id=str(bc.id),
        user=current_user,
        payload={"details": f"Bulk project '{bc.name}' was deactivated with {len(affected_orders)} active order(s)."},
    )
    return success_response(message="Bulk Project and related active orders deactivated.")


@router.get("/bulk-classes/{bc_id}", response_model=dict, summary="Get Bulk Project Detail")
def get_bulk_class(
    bc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(AllStaff),
):
    bc = BulkClassRepository.get_by_id(db, bc_id)
    if not bc:
        from fastapi import HTTPException
        raise HTTPException(404, "Bulk Project not found.")
    if not _is_admin_user(current_user) and str(bc.created_by) != str(current_user.id):
        allowed_vendor_ids = set(_allowed_vendor_ids(db, current_user) or [])
        if not any(str(order.vendor_id) in allowed_vendor_ids for order in bc.orders if order.is_active):
            raise HTTPException(status_code=403, detail="You can only access your assigned bulk projects.")
    return success_response(data={
        "id": str(bc.id),
        "name": bc.name,
        "serial_number": bc.serial_number,
        "customer": bc.customer,
        "status": bc.status,
        "remarks": bc.remarks,
        "vendor_names": sorted({order.vendor.name for order in bc.orders if order.is_active and order.vendor}),
        "order_count": len(bc.orders),
    })


@router.post("/bulk", response_model=dict, summary="Bulk Create Orders (Style Phase)")
def bulk_create_orders(
    payload: BulkOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(ManagerAccess),
):
    for item in payload.items:
        assert_vendor_access(db, item.vendor_id, current_user)
    orders = OrderService.bulk_create_orders(db, payload, str(current_user.id))
    ActivityLogService.record(
        db,
        action="BULK_ORDERS_CREATED",
        entity_type="Order",
        entity_id=str(payload.bulk_class_id),
        user=current_user,
        payload={"details": f"{len(orders)} bulk production batches initialized."},
    )
    return success_response(
        data={"count": len(orders)},
        message=f"Successfully initialized {len(orders)} production batches."
    )


# ─── Order Endpoints ────────────────────────────────────────────────────────

@router.get("", response_model=dict, summary="List Orders")
@router.get("/", response_model=dict, summary="List Orders")
def list_orders(
    vendor_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    track_type: Optional[str] = Query(None),
    sample_class_id: Optional[str] = Query(None),
    bulk_class_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(AllStaff),
):
    if vendor_id:
        assert_vendor_access(db, vendor_id, current_user)
    allowed_vendor_ids = _allowed_vendor_ids(db, current_user)
    orders = OrderService.list_orders(
        db, client_id=vendor_id, status=status, 
        track_type=track_type, skip=skip, limit=limit,
        sample_class_id=sample_class_id, bulk_class_id=bulk_class_id,
        allowed_vendor_ids=allowed_vendor_ids,
    )
    return success_response(data=[
        {
            "id": str(o.id), 
            "order_no": o.order_no, 
            "vendor_id": str(o.vendor_id),
            "vendor_name": o.vendor.name if o.vendor else None,
            "style_name": o.style_name,
            "product_name": o.product_name,
            "quantity": o.quantity,
            "ex_factory_date": str(o.ex_factory_date) if o.ex_factory_date else None,
            "reference_attachments": o.reference_attachments or [],
            "status": o.status.value, 
            "priority": o.priority.value,
            "track_type": o.track_type.value,
            "is_delayed": getattr(o, "is_delayed", False),
            "delay_days": o.delay_days,
            "top_sample_status": o.top_sample_status,
            "qa_audit_status": o.qa_audit_status
        }
        for o in orders
    ])


@router.post("", response_model=dict, summary="Create Order")
@router.post("/", response_model=dict, summary="Create Order")
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(ManagerAccess),
):
    assert_vendor_access(db, payload.vendor_id, current_user)
    order = OrderService.create_order(db, payload, str(current_user.id))
    ActivityLogService.record(
        db,
        action="ORDER_CREATED",
        entity_type="Order",
        entity_id=str(order.id),
        user=current_user,
        payload={"details": f"Order '{order.order_no or order.product_name or order.style_name}' was created."},
    )
    return success_response(
        data={"id": str(order.id), "order_no": order.order_no},
        message="Order created successfully."
    )


@router.delete("/{order_id}", response_model=dict, summary="Cancel/Deactivate Order")
def delete_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(AllStaff),
):
    _assert_order_access(db, order_id, current_user)
    order = OrderService.delete_order(db, order_id, str(current_user.id))
    ActivityLogService.record(
        db,
        action="ORDER_CANCELLED",
        entity_type="Order",
        entity_id=order_id,
        user=current_user,
        payload={"details": f"Order '{order.order_no or order.product_name or order.style_name}' was cancelled/deactivated."},
    )
    return success_response(message="Order cancelled successfully.")


@router.get("/{order_id}/history", response_model=dict, summary="Get Order History")
def get_order_history(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(AllStaff),
):
    _assert_order_access(db, order_id, current_user)
    order_events = db.query(OrderHistory).filter(OrderHistory.order_id == order_id).order_by(OrderHistory.created_at.desc()).all()
    audit_events = db.query(AuditLog).filter(
        AuditLog.entity_type == "Order",
        AuditLog.entity_id == str(order_id),
    ).order_by(AuditLog.created_at.desc()).all()

    def audit_payload(log: AuditLog) -> dict:
        if not log.payload:
            return {}
        try:
            parsed = json.loads(log.payload)
            return parsed if isinstance(parsed, dict) else {"value": parsed}
        except json.JSONDecodeError:
            return {"details": log.payload}

    events = [
        {
            "id": str(item.id),
            "source": "order_history",
            "action": item.action,
            "details": item.note or "",
            "old_value": item.old_value,
            "new_value": item.new_value,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "user": item.changed_by_user.full_name if item.changed_by_user else "System",
        }
        for item in order_events
    ]
    events.extend([
        {
            "id": str(log.id),
            "source": "activity_log",
            "action": log.action,
            "details": audit_payload(log).get("details") or audit_payload(log).get("message") or "",
            "old_value": audit_payload(log).get("old"),
            "new_value": audit_payload(log).get("new"),
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "user": log.user.full_name if log.user else "System",
        }
        for log in audit_events
    ])
    events.sort(key=lambda item: item["created_at"] or "", reverse=True)
    return success_response(data=events)


@router.get("/{order_id}", response_model=dict, summary="Get Order Detail")
def get_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(AllStaff),
):
    order = _assert_order_access(db, order_id, current_user)
    return success_response(data={
        "id": str(order.id), 
        "order_no": order.order_no,
        "vendor_id": str(order.vendor_id),
        "vendor_name": order.vendor.name if order.vendor else None,
        "style_name": order.style_name,
        "product_name": order.product_name,
        "product_type": order.product_type,
        "fabric": order.fabric,
        "quantity": order.quantity,
        "ex_factory_date": str(order.ex_factory_date) if order.ex_factory_date else None,
        "status": order.status.value, 
        "priority": order.priority.value,
        "track_type": order.track_type.value,
        "remarks": order.remarks,
        "requirements": order.requirements,
        "reference_image": order.reference_image,
        "reference_attachments": order.reference_attachments or [],
        "current_iteration": order.current_iteration,
        "iteration_reason": order.iteration_reason,
        "iteration_plan": order.iteration_plan,
        "iteration_history": order.iteration_history,
        "top_sample_status": order.top_sample_status,
        "qa_audit_status": order.qa_audit_status,
        "delay_days": order.delay_days,
        "sample_class_id": str(order.sample_class_id) if order.sample_class_id else None,
        "sample_class_name": order.sample_class.name if order.sample_class else None,
        "order_placement_date": str(order.order_placement_date) if getattr(order, 'order_placement_date', None) else None,
        "attachments": [
            {
                "id": str(a.id),
                "file_name": a.file_name,
                "file_path": a.file_path,
                "file_type": a.file_type,
                "created_at": a.created_at.isoformat()
            }
            for a in order.attachments
        ]
    })


@router.put("/{order_id}", response_model=dict, summary="Update Order")
def update_order(
    order_id: str,
    payload: OrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(ManagerAccess),
):
    _assert_order_access(db, order_id, current_user)
    if payload.vendor_id:
        assert_vendor_access(db, payload.vendor_id, current_user)
    OrderService.update_order(db, order_id, payload, str(current_user.id))
    ActivityLogService.record(
        db,
        action="ORDER_UPDATED",
        entity_type="Order",
        entity_id=order_id,
        user=current_user,
        payload={"details": "Order details were updated."},
    )
    return success_response(message="Order updated successfully.")


# ─── Production Stages ─────────────────────────────────────────────────────

@router.get("/{order_id}/stages", response_model=dict, summary="Get Production Stages")
def get_stages(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(AllStaff),
):
    _assert_order_access(db, order_id, current_user)
    stages = StageService.get_stages(db, order_id)
    return success_response(data=[
        {
            "id": str(s.id), 
            "stage_name": s.stage_name.value,
            "stage_order": s.stage_order,
            "module_type": s.module_type.value,
            "start_date": s.start_date.isoformat() if s.start_date else None,
            "completion_date": s.completion_date.isoformat() if s.completion_date else None,
            "target_date": s.target_date.isoformat() if s.target_date else None,
            "status": s.status.value, 
            "remarks": s.remarks,
            "attachment_url": s.attachment_url,
            "responsible_person": s.responsible_person.full_name if s.responsible_person else None,
            "updated_by": s.updater.full_name if s.updater else None,
            "chunk_id": str(s.chunk_id) if s.chunk_id else None,
            "chunk_name": s.chunk.name if s.chunk else None,
            "chunk_target_days": s.chunk.target_days if s.chunk else None,
        }
        for s in stages
    ])


@router.get("/{order_id}/assignments", summary="Get Production Assignments for Order")
def get_order_assignments(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(AllStaff),
):
    _assert_order_access(db, order_id, current_user)
    from app.models.order import OrderProductionAssignment
    assignments = db.query(OrderProductionAssignment).filter(
        OrderProductionAssignment.order_id == order_id
    ).all()
    return success_response(data=[{
        "id": str(a.id),
        "floor_name": a.floor.name if a.floor else None,
        "line_name": a.line.name if a.line else "Full Floor",
        "assignment_type": a.assignment_type,
        "notes": a.notes,
    } for a in assignments])


@router.post("/{order_id}/reiterate", response_model=dict, summary="Reject and Restart Iteration")
def reiterate_order(
    order_id: str,
    payload: dict, # {reason: str, plan: str}
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(AllStaff),
):
    _assert_order_access(db, order_id, current_user)
    reason = payload.get("reason", "No reason provided")
    plan = payload.get("plan", "No plan provided")
    order = OrderService.reiterate_order(db, order_id, reason, plan, str(current_user.id))
    ActivityLogService.record(
        db,
        action="ORDER_REITERATED",
        entity_type="Order",
        entity_id=order_id,
        user=current_user,
        payload={"details": f"Order moved to iteration {order.current_iteration}.", "reason": reason},
    )
    return success_response(
        data={"id": str(order.id), "current_iteration": order.current_iteration},
        message=f"Order moved to Iteration {order.current_iteration}."
    )


@router.post("/{order_id}/stages", response_model=dict, summary="Add Production Stage")
def add_stage(
    order_id: str,
    payload: StageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(ManagerAccess),
):
    _assert_order_access(db, order_id, current_user)
    stage = StageService.add_stage(db, order_id, payload, str(current_user.id))
    ActivityLogService.record(
        db,
        action="ORDER_STAGE_ADDED",
        entity_type="Order",
        entity_id=order_id,
        user=current_user,
        payload={"details": f"Stage '{stage.stage_name.value}' was added."},
    )
    return success_response(
        data={"id": str(stage.id), "stage_name": stage.stage_name.value},
        message="Stage added."
    )


@router.put("/stages/{stage_id}", response_model=dict, summary="Update Production Stage")
def update_stage(
    stage_id: str,
    payload: StageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(AllStaff),
):
    _assert_stage_order_access(db, stage_id, current_user)
    stage = StageService.update_stage(db, stage_id, payload, str(current_user.id))
    ActivityLogService.record(
        db,
        action="ORDER_STAGE_UPDATED",
        entity_type="Order",
        entity_id=str(stage.order_id),
        user=current_user,
        payload={
            "details": f"Stage '{stage.stage_name.value}' was marked {stage.status.value}.",
            "stage_id": stage_id,
            "stage": stage.stage_name.value,
            "status": stage.status.value,
        },
    )
    return success_response(message="Stage updated.")


@router.post("/stages/{stage_id}/rework", response_model=dict, summary="Reject Stage and Repeat From Selected Stage")
def reject_stage_for_rework(
    stage_id: str,
    payload: StageReworkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(AllStaff),
):
    _assert_stage_order_access(db, stage_id, current_user)
    order = StageService.reject_stage_for_rework(
        db,
        stage_id,
        payload.repeat_from_stage_id,
        payload.reason,
        payload.plan or "",
        str(current_user.id),
    )
    ActivityLogService.record(
        db,
        action="ORDER_STAGE_REWORK",
        entity_type="Order",
        entity_id=str(order.id),
        user=current_user,
        payload={
            "details": f"Order moved to iteration {order.current_iteration} for stage rework.",
            "reason": payload.reason,
            "repeat_from_stage_id": payload.repeat_from_stage_id,
        },
    )
    return success_response(
        data={"id": str(order.id), "current_iteration": order.current_iteration},
        message=f"Stage rejected. Iteration {order.current_iteration} started."
    )


# ─── File Attachments ──────────────────────────────────────────────────────

ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}

@router.post("/{order_id}/attachments", response_model=dict, summary="Upload Attachment")
def upload_attachment(
    order_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(AllStaff),
):
    _assert_order_access(db, order_id, current_user)
    if file.content_type not in ALLOWED_TYPES:
        from app.utils.response import error_response
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Only PDF and image files are allowed.")

    ext = file.filename.split(".")[-1].lower()
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    attachment = Attachment(
        order_id=order_id,
        file_name=file.filename,
        file_path=filepath,
        file_type=file.content_type,
        uploaded_by=current_user.id,
    )
    db.add(attachment)
    db.commit()
    ActivityLogService.record(
        db,
        action="ORDER_ATTACHMENT_ADDED",
        entity_type="Order",
        entity_id=order_id,
        user=current_user,
        payload={"details": f"Attachment '{file.filename}' was added."},
    )

    return success_response(
        data={"file_name": file.filename, "file_path": filepath},
        message="File uploaded successfully."
    )
