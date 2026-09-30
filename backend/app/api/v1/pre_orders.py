"""
Pre-Order Requests API — "Orders to Process" module.
Access:
  - Super Admin / Admin : full CRUD (create, edit, delete, ignore, link)
  - Manager / QC / Viewer: read-only — see only their own assigned pre-orders
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import require_roles, get_current_user
from app.models.user import RoleEnum, User
from app.schemas.pre_order import PreOrderCreate, PreOrderUpdate, PreOrderLinkOrder, PreOrderIgnore, PreOrderProceed, PreOrderInitializeClass
from app.services.pre_order_service import PreOrderService
from app.utils.response import success_response

router = APIRouter(prefix="/pre-orders", tags=["Pre-Order Requests"])

# ── Role gates ──────────────────────────────────────────────────────────────
# READ : any authenticated user (they only see their own rows if not admin)
ReadAccess  = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager, RoleEnum.qc_officer, RoleEnum.viewer])
# WRITE: super_admin and admin only
WriteAccess = require_roles([RoleEnum.super_admin, RoleEnum.admin])


@router.get("", summary="List pre-order requests")
@router.get("/", summary="List pre-order requests")
def list_pre_orders(
    status: Optional[str] = Query(None, description="Filter: pending | processed | overdue | ignored"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(ReadAccess),
):
    data = PreOrderService.list_all(db, current_user, status=status, skip=skip, limit=limit)
    return success_response(data=data)


@router.post("", summary="Create a new pre-order request")
@router.post("/", summary="Create a new pre-order request")
def create_pre_order(
    payload: PreOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(WriteAccess),   # admin only
):
    data = PreOrderService.create(db, payload, current_user)
    return success_response(data=data, message="Pre-order created. Assignment email sent.")


@router.get("/stats/summary", summary="Summary counts for dashboard widgets")
def pre_order_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(ReadAccess),
):
    """Returns counts by status for dashboard stat cards."""
    from app.models.pre_order_request import PreOrderRequest, PreOrderStatus
    query = db.query(PreOrderRequest)

    role_name = _role_name(current_user)
    is_admin = any(r in role_name for r in ("super_admin", "admin"))
    if not is_admin:
        query = query.filter(PreOrderRequest.assigned_manager_id == current_user.id)

    all_reqs = query.all()
    counts = {"total": len(all_reqs), "pending": 0, "partial": 0, "processed": 0, "overdue": 0, "ignored": 0}
    for r in all_reqs:
        s = r.status.value if hasattr(r.status, "value") else str(r.status)
        if s in counts:
            counts[s] += 1
    return success_response(data=counts)


@router.get("/{pre_order_id}", summary="Get a single pre-order request")
def get_pre_order(
    pre_order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(ReadAccess),
):
    data = PreOrderService.get(db, pre_order_id, current_user)
    return success_response(data=data)


@router.put("/{pre_order_id}", summary="Update a pre-order request")
def update_pre_order(
    pre_order_id: str,
    payload: PreOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(WriteAccess),   # admin only
):
    data = PreOrderService.update(db, pre_order_id, payload, current_user)
    return success_response(data=data, message="Pre-order updated.")


@router.post("/{pre_order_id}/link-order", summary="Link pre-order to an actual order (mark as processed)")
def link_order(
    pre_order_id: str,
    payload: PreOrderLinkOrder,
    db: Session = Depends(get_db),
    current_user: User = Depends(WriteAccess),   # admin only
):
    data = PreOrderService.link_order(db, pre_order_id, payload.order_id, current_user, products_count=payload.products_count or 1)
    return success_response(data=data, message="Pre-order linked to order.")


@router.post("/{pre_order_id}/initialize-class", summary="Initialize collection class and get order workspace link")
def initialize_pre_order_class(
    pre_order_id: str,
    payload: Optional[PreOrderInitializeClass] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(ReadAccess),   # verified in service: admin or assigned manager
):
    result = PreOrderService.initialize_class(db, pre_order_id, current_user, payload=payload)
    return success_response(
        data=result,
        message=f"Collection '{result['class_name']}' ready. Redirecting to order workspace.",
    )


@router.post("/{pre_order_id}/proceed", summary="Proceed pre-order to production (creates actual order & initializes workflow)")
def proceed_pre_order(
    pre_order_id: str,
    payload: PreOrderProceed,
    db: Session = Depends(get_db),
    current_user: User = Depends(ReadAccess),   # verified in service: admin or assigned manager
):
    result = PreOrderService.proceed_to_order(db, pre_order_id, payload, current_user)
    return success_response(
        data=result,
        message="Order successfully launched into production! Stages initialized.",
    )


@router.post("/{pre_order_id}/ignore", summary="Mark a pre-order as ignored")
def ignore_pre_order(
    pre_order_id: str,
    payload: PreOrderIgnore,
    db: Session = Depends(get_db),
    current_user: User = Depends(WriteAccess),   # admin only
):
    data = PreOrderService.ignore(db, pre_order_id, payload.reason, current_user)
    return success_response(data=data, message="Pre-order marked as ignored.")


@router.delete("/{pre_order_id}", summary="Delete a pre-order request")
def delete_pre_order(
    pre_order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(WriteAccess),   # admin only
):
    PreOrderService.delete(db, pre_order_id, current_user)
    return success_response(message="Pre-order request deleted.")


# ── Helper ───────────────────────────────────────────────────────────────────
def _role_name(user: User) -> str:
    if not user.role:
        return ""
    name = getattr(user.role, "name", "") or ""
    if hasattr(name, "value"):
        return str(name.value).lower()
    return str(name).lower()
