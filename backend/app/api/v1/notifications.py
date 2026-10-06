"""
Notifications API.
Per-user alert system with:
- Zone 1: Ex-Factory Date Passed (Delay Reason + CAPA + Recovery Date)
- Zone 2: Development / Process Stage Delayed (Root Cause + CAPA + Revised Completion Date)
- Instant alerts on Order creation and Class creation (both Sample and Bulk phases)
- RBAC: Admin & Super Admin see all notifications company-wide; other roles see only their own.
- Rich Lead-Manager-compatible HTML rendering, time badges, and status tracking.
"""
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, String, cast, or_
from datetime import date, timedelta, datetime
from typing import Optional
from pydantic import BaseModel
import uuid

from app.repositories.order_repo import _id_variants

from app.core.database import get_db, SessionLocal
from app.core.dependencies import get_current_user
from app.models.user import User, RoleEnum
from app.models.order import Order, ProductionStage, OrderStatus, StageStatus, TrackType
from app.models.comments_notifications import Notification
from app.utils.response import success_response

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ─── RBAC Helper ─────────────────────────────────────────────────────────────

def _is_admin_user(user: User) -> bool:
    """Return True if user is super_admin or admin."""
    role_name = ""
    if user.role:
        role_name = str(getattr(user.role, "name", "") or "").lower()
        if hasattr(user.role.name, "value"):
            role_name = str(user.role.name.value).lower()
    return any(adm in role_name for adm in ("super_admin", "admin"))


# ─── Time Formatting Helpers (GMT+5) ─────────────────────────────────────────

def _format_time_badge(dt: datetime) -> str:
    """e.g. '13 minutes ago at 01:19 AM GMT+5'"""
    if not dt:
        return ""
    now = datetime.utcnow()
    diff_sec = max(0, int((now - dt).total_seconds()))
    m = diff_sec // 60
    h = diff_sec // 3600
    d = diff_sec // 86400
    if m < 1:
        rel = "just now"
    elif m < 60:
        rel = f"{m} minute{'s' if m != 1 else ''} ago"
    elif h < 24:
        rel = f"{h} hour{'s' if h != 1 else ''} ago"
    else:
        rel = f"{d} day{'s' if d != 1 else ''} ago"
    
    gmt5 = dt + timedelta(hours=5)
    return f"{rel} at {gmt5.strftime('%I:%M %p GMT+5')}"


def _format_date_green(dt: datetime) -> str:
    """e.g. '09/09/2026, 05:00 AM GMT+5'"""
    if not dt:
        return ""
    gmt5 = dt + timedelta(hours=5)
    return gmt5.strftime("%m/%d/%Y, %I:%M %p GMT+5")


# ─── Serializer ──────────────────────────────────────────────────────────────

def _serialize(n: Notification) -> dict:
    created = n.created_at or datetime.utcnow()
    return {
        "id": str(n.id),
        "user_id": str(n.user_id),
        "title": n.title,
        "message": n.message,
        "html_content": n.html_content or n.message,
        "category": n.category or "general",
        "type": n.type,
        "order_id": str(n.order_id) if n.order_id else None,
        "stage_id": str(n.stage_id) if n.stage_id else None,
        "class_id": str(n.class_id) if getattr(n, "class_id", None) else None,
        "extra_data": n.extra_data or {},
        "is_read": n.is_read,
        "created_at": created.isoformat(),
        "formatted_time": _format_time_badge(created),
        "formatted_date": _format_date_green(created),
    }


# ─── Public Endpoints ────────────────────────────────────────────────────────

@router.get("", summary="Get all notifications (admin sees all, non-admin sees own)")
@router.get("/", summary="Get all notifications (admin sees all, non-admin sees own)")
def get_notifications(
    include_read: bool = False,
    limit: int = 60,
    all_users: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification)
    # RBAC: Only admin & super_admin can see company-wide notifications.
    # Other users (managers, qc officers, viewers) only see their own.
    if not _is_admin_user(current_user) or not all_users:
        query = query.filter(
            cast(Notification.user_id, String).in_(_id_variants(str(current_user.id)))
        )

    if not include_read:
        query = query.filter(Notification.is_read == False)

    notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()
    return success_response(data=[_serialize(n) for n in notifications])


@router.get("/unread-count", summary="Get count of unread notifications")
def unread_count(
    all_users: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(func.count(Notification.id)).filter(Notification.is_read == False)
    if not _is_admin_user(current_user) or not all_users:
        query = query.filter(
            cast(Notification.user_id, String).in_(_id_variants(str(current_user.id)))
        )
    count = query.scalar()
    return success_response(data={"count": count or 0})


@router.post("/mark-read/{notification_id}", summary="Mark one notification as read")
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification).filter(
        cast(Notification.id, String).in_(_id_variants(str(notification_id)))
    )
    if not _is_admin_user(current_user):
        query = query.filter(
            cast(Notification.user_id, String).in_(_id_variants(str(current_user.id)))
        )
    n = query.first()
    if n:
        n.is_read = True
        db.commit()
    return success_response(message="Marked as read.")


@router.post("/mark-all-read", summary="Mark all notifications as read")
def mark_all_read(
    all_users: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification).filter(Notification.is_read == False)
    if not _is_admin_user(current_user) or not all_users:
        query = query.filter(
            cast(Notification.user_id, String).in_(_id_variants(str(current_user.id)))
        )
    query.update({"is_read": True}, synchronize_session=False)
    db.commit()
    return success_response(message="All notifications marked as read.")


@router.post("/check-now", summary="Manually trigger a notification scan")
def trigger_check(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    background_tasks.add_task(run_notification_scan)
    return success_response(message="Notification scan triggered in background.")


# ─── Target Users Helper ──────────────────────────────────────────────────────

def _get_target_users(db: Session, order: Optional[Order] = None) -> list[User]:
    """Return managers and admins who should receive notifications."""
    users = db.query(User).filter(User.is_active == True).all()
    target_users = []
    for u in users:
        r_name = ""
        if u.role:
            r_name = str(getattr(u.role, "name", "") or "").lower()
            if hasattr(u.role.name, "value"):
                r_name = str(u.role.name.value).lower()
        if any(match in r_name for match in ("super_admin", "admin", "manager")):
            target_users.append(u)
    return target_users


# ─── Deduplication Check (Fixed with order_id & stage_id) ──────────────────────

def _already_notified_today(
    db: Session,
    user_id,
    order_id: Optional[str] = None,
    stage_id: Optional[str] = None,
    notif_type: str = "stage_overdue",
) -> bool:
    """Prevent duplicate notifications for the same entity and type."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    query = db.query(Notification).filter(
        cast(Notification.user_id, String).in_(_id_variants(str(user_id))),
        Notification.type == notif_type,
    )
    if order_id:
        query = query.filter(cast(Notification.order_id, String).in_(_id_variants(str(order_id))))
    if stage_id:
        query = query.filter(cast(Notification.stage_id, String).in_(_id_variants(str(stage_id))))

    # Suppress duplicate if there is ALREADY an unread alert for this entity, OR if one was sent today
    existing = query.filter(
        or_(
            Notification.is_read == False,
            Notification.created_at >= today_start,
        )
    ).first()
    return existing is not None


# ─── Instant Dispatch Functions ───────────────────────────────────────────────

def dispatch_order_created_notification(db: Session, order: Order, creator_user: Optional[User] = None):
    """Dispatches instant notification to managers/admins when a new order is created."""
    target_users = _get_target_users(db, order)
    order_no = order.order_no or f"Order #{str(order.id)[:8]}"
    product = order.product_name or order.style_name or "Unnamed Product"
    track_val = (order.track_type.value if hasattr(order.track_type, "value") else str(order.track_type)).upper()
    vendor_name = order.vendor.name if order.vendor else "Assigned Vendor"
    qty = order.quantity or 0
    ex_fac = str(order.ex_factory_date) if order.ex_factory_date else "TBD"
    creator_name = creator_user.full_name if creator_user else "System"

    title = f"ID: {order_no} | {product.upper()}"
    msg = f"New {track_val} Order {order_no} ({product}) created with {qty} pcs for {vendor_name}. Ex-Factory: {ex_fac}."
    html = (
        f"<b>NEW {track_val} ORDER CREATED:</b> PO <b>{order_no}</b> (<i>{product}</i>) assigned to <b>{vendor_name}</b>.<br/>"
        f"<span class='mt-1 block text-slate-600'>Quantity: <b>{qty:,} pcs</b> | Ex-Factory: <b>{ex_fac}</b> | Created by: <b>{creator_name}</b></span>"
    )

    for u in target_users:
        db.add(Notification(
            user_id=u.id,
            title=title,
            message=msg,
            html_content=html,
            category="order_created",
            type="order_created",
            order_id=order.id,
            extra_data={
                "order_no": order_no,
                "product": product,
                "track_type": track_val,
                "quantity": qty,
                "vendor_name": vendor_name,
                "ex_factory_date": ex_fac,
                "creator_name": creator_name,
            }
        ))
    db.commit()


def dispatch_class_created_notification(db: Session, class_obj, is_bulk: bool, creator_user: Optional[User] = None):
    """Dispatches instant notification when a new Sample Class or Bulk Project is created."""
    target_users = _get_target_users(db)
    phase_title = "Bulk Project" if is_bulk else "Sample Class"
    c_name = class_obj.name
    serial = class_obj.serial_number or "N/A"
    customer = class_obj.customer or "N/A"
    vendor_name = class_obj.vendor.name if getattr(class_obj, "vendor", None) else "Assigned Vendor"
    creator_name = creator_user.full_name if creator_user else "System"

    title = f"ID: {serial} | {c_name.upper()}"
    msg = f"New {phase_title} '{c_name}' (Serial: {serial}) created for Customer {customer}."
    html = (
        f"<b>NEW {phase_title.upper()} CREATED:</b> <b>{c_name}</b> (Serial: <i>{serial}</i>).<br/>"
        f"<span class='mt-1 block text-slate-600'>Customer: <b>{customer}</b> | Vendor: <b>{vendor_name}</b> | Created by: <b>{creator_name}</b></span>"
    )

    for u in target_users:
        db.add(Notification(
            user_id=u.id,
            title=title,
            message=msg,
            html_content=html,
            category="class_created",
            type="class_created",
            class_id=class_obj.id,
            extra_data={
                "class_name": c_name,
                "serial_number": serial,
                "customer": customer,
                "phase": phase_title,
                "is_bulk": is_bulk,
                "creator_name": creator_name,
            }
        ))
    db.commit()


# ─── Background Scanner (Zone 1 & Zone 2) ─────────────────────────────────────

def run_notification_scan():
    """
    Scans all active orders and their stages.
    - ZONE 1 – EX-FACTORY DATE PASSED:
      Committed date passed. Highlights DELAY REASON + CAPA + RECOVERY DATE.
    - ZONE 2 – DEVELOPMENT / PROCESS STAGE DELAYED:
      Target date passed. Highlights ROOT CAUSE + CAPA + REVISED COMPLETION DATE.
    - Ex-Factory Approaching (within 7 days warning).
    Safe to call repeatedly (deduplicates once per entity per day).
    """
    db: Session = SessionLocal()
    try:
        today = date.today()
        in_7_days = today + timedelta(days=7)

        active_orders = db.query(Order).filter(
            Order.status.notin_([OrderStatus.completed, OrderStatus.cancelled]),
            Order.is_active == True,
        ).all()

        target_users = _get_target_users(db)

        for order in active_orders:
            order_no = order.order_no or f"Order #{str(order.id)[:8]}"
            product = order.product_name or order.style_name or "Product"
            track_val = (order.track_type.value if hasattr(order.track_type, "value") else str(order.track_type)).lower()
            is_sample = track_val == "sample"

            # ── 1. Ex-Factory Date Passed OR 1 Day Before ────────────────────────
            if order.ex_factory_date:
                if order.ex_factory_date < today:
                    days_overdue = (today - order.ex_factory_date).days
                    title = f"ID: {order_no} | {product.upper()}"
                    message = f"ZONE 1 – EX-FACTORY DATE PASSED: PO {order_no} ({product}) is {days_overdue} day(s) overdue (Committed: {order.ex_factory_date})."
                    html_content = (
                        f"<b>ZONE 1 – EX-FACTORY DATE PASSED:</b> PO <b>{order_no}</b> (<i>{product}</i>) is "
                        f"<span class='text-rose-600 font-bold'>{days_overdue} day(s) overdue</span> (Committed: {order.ex_factory_date}).<br/>"
                        f"<span class='text-slate-600'>The DELAY REASON + CAPA + RECOVERY DATE must be documented.</span>"
                    )
                    for u in target_users:
                        if not _already_notified_today(db, u.id, order_id=str(order.id), stage_id=None, notif_type="ex_factory_passed"):
                            db.add(Notification(
                                user_id=u.id,
                                title=title,
                                message=message,
                                html_content=html_content,
                                category="zone_1_ex_factory_passed",
                                type="ex_factory_passed",
                                order_id=order.id,
                                extra_data={"days_overdue": days_overdue, "ex_factory_date": str(order.ex_factory_date)}
                            ))
                elif order.ex_factory_date in (today, today + timedelta(days=1)):
                    days_left = (order.ex_factory_date - today).days
                    day_label = "TODAY" if days_left == 0 else "TOMORROW (1 day before)"
                    title = f"ID: {order_no} | {product.upper()}"
                    message = f"EX-FACTORY DUE {day_label}: PO {order_no} ({product}) ex-factory date is {order.ex_factory_date}."
                    html_content = (
                        f"<b>EX-FACTORY DUE {day_label}:</b> PO <b>{order_no}</b> (<i>{product}</i>) committed ex-factory date is "
                        f"<span class='text-amber-600 font-bold'>{order.ex_factory_date}</span>."
                    )
                    for u in target_users:
                        if not _already_notified_today(db, u.id, order_id=str(order.id), stage_id=None, notif_type="ex_factory_approaching"):
                            db.add(Notification(
                                user_id=u.id,
                                title=title,
                                message=message,
                                html_content=html_content,
                                category="ex_factory_approaching",
                                type="ex_factory_approaching",
                                order_id=order.id,
                                extra_data={"days_left": days_left, "ex_factory_date": str(order.ex_factory_date)}
                            ))

            # ── 2. Stage Days Delay OR 1 Day Before ─────────────────────────────
            for stage in order.stages:
                if stage.status in (StageStatus.completed, StageStatus.skipped):
                    continue
                if not stage.target_date:
                    continue

                stage_target = stage.target_date.date() if hasattr(stage.target_date, "date") else stage.target_date
                stage_label = str(stage.stage_name.value if hasattr(stage.stage_name, "value") else stage.stage_name).replace("_", " ").title()
                zone_title = "ZONE 2 – DEVELOPMENT STAGE DELAYED" if is_sample else "ZONE 2 – PROCESS STAGE DELAYED"

                if stage_target < today:
                    days_late = (today - stage_target).days
                    title = f"ID: {order_no} | {product.upper()} — {stage_label}"
                    message = f"[{zone_title}] PO {order_no} stuck at {stage_label} ({days_late} day(s) overdue, Target: {stage_target})."
                    html_content = (
                        f"<b>{zone_title}:</b> PO <b>{order_no}</b> stuck at <b>{stage_label}</b> "
                        f"(<span class='text-rose-600 font-bold'>{days_late} day(s) overdue</span>, Target: <i>{stage_target}</i>).<br/>"
                        f"<span class='text-slate-600'>The ROOT CAUSE, CORRECTIVE/PREVENTIVE ACTION AND REVISED STAGE COMPLETION DATE must be updated.</span>"
                    )
                    for u in target_users:
                        if not _already_notified_today(db, u.id, order_id=str(order.id), stage_id=str(stage.id), notif_type="stage_overdue"):
                            db.add(Notification(
                                user_id=u.id,
                                title=title,
                                message=message,
                                html_content=html_content,
                                category="zone_2_stage_delayed",
                                type="stage_overdue",
                                order_id=order.id,
                                stage_id=stage.id,
                                extra_data={
                                    "days_late": days_late,
                                    "stage_name": stage_label,
                                    "target_date": str(stage_target),
                                }
                            ))
                elif stage_target in (today, today + timedelta(days=1)):
                    days_left = (stage_target - today).days
                    day_label = "TODAY" if days_left == 0 else "TOMORROW (1 day before)"
                    title = f"ID: {order_no} | {product.upper()} — {stage_label}"
                    message = f"STAGE DUE {day_label}: PO {order_no} stage {stage_label} target date is {stage_target}."
                    html_content = (
                        f"<b>STAGE DUE {day_label}:</b> PO <b>{order_no}</b> stage <b>{stage_label}</b> target completion is "
                        f"<span class='text-amber-600 font-bold'>{stage_target}</span>."
                    )
                    for u in target_users:
                        if not _already_notified_today(db, u.id, order_id=str(order.id), stage_id=str(stage.id), notif_type="stage_approaching"):
                            db.add(Notification(
                                user_id=u.id,
                                title=title,
                                message=message,
                                html_content=html_content,
                                category="stage_approaching",
                                type="stage_approaching",
                                order_id=order.id,
                                stage_id=stage.id,
                                extra_data={
                                    "days_left": days_left,
                                    "stage_name": stage_label,
                                    "target_date": str(stage_target),
                                }
                            ))

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Notification Scanner Error] {e}")
    finally:
        db.close()
