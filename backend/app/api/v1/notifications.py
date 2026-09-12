"""
Notifications API.
Per-user alert system for stage deadlines and ex-factory events.
Supports: list unread, unread count, mark read, mark all read.
Background scheduler checks for overdue/approaching stages every 15 min.
"""
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta, datetime
from typing import Optional

from app.core.database import get_db, SessionLocal
from app.core.dependencies import get_current_user
from app.models.user import User, RoleEnum
from app.models.order import Order, ProductionStage, OrderStatus, StageStatus
from app.models.comments_notifications import Notification
from app.utils.response import success_response

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ─── Public Endpoints ────────────────────────────────────────────────────────

@router.get("/", summary="Get all notifications for current user (unread first)")
def get_notifications(
    include_read: bool = False,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if not include_read:
        query = query.filter(Notification.is_read == False)
    notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()

    return success_response(data=[_serialize(n) for n in notifications])


@router.get("/unread-count", summary="Get count of unread notifications")
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = db.query(func.count(Notification.id)).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).scalar()
    return success_response(data={"count": count or 0})


@router.post("/mark-read/{notification_id}", summary="Mark one notification as read")
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if n:
        n.is_read = True
        db.commit()
    return success_response(message="Marked as read.")


@router.post("/mark-all-read", summary="Mark all notifications as read")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return success_response(message="All notifications marked as read.")


@router.post("/check-now", summary="Manually trigger a notification scan (admin use)")
def trigger_check(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    background_tasks.add_task(run_notification_scan)
    return success_response(message="Notification scan triggered in background.")


# ─── Serializer ──────────────────────────────────────────────────────────────

def _serialize(n: Notification) -> dict:
    return {
        "id": str(n.id),
        "title": n.title,
        "message": n.message,
        "type": n.type,
        "order_id": str(n.order_id) if n.order_id else None,
        "stage_id": str(n.stage_id) if n.stage_id else None,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat(),
    }


# ─── Background Scanner ───────────────────────────────────────────────────────

def _already_notified_today(db: Session, user_id, stage_id: Optional[str], notif_type: str) -> bool:
    """Prevent duplicate notifications for the same stage/type on the same day."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    query = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.type == notif_type,
        Notification.created_at >= today_start,
    )
    if stage_id:
        query = query.filter(Notification.stage_id == stage_id)
    return query.first() is not None


def _get_target_users(db: Session, order: Order) -> list:
    """Return managers and admins who should receive notifications for this order."""
    from app.models.user import User as UserModel
    users = db.query(UserModel).filter(
        UserModel.is_active == True,
        UserModel.role.in_(["super_admin", "admin", "manager"]),
    ).all()
    return users


def run_notification_scan():
    """
    Scans all active orders and their stages.
    Creates notifications for:
      - stage_overdue: stage target_date < today and stage is not completed
      - ex_factory_approaching: ex_factory_date within 7 days
      - ex_factory_passed: ex_factory_date has already passed
    Runs as a background task. Safe to call multiple times (deduplicates per day).
    """
    db: Session = SessionLocal()
    try:
        today = date.today()
        in_7_days = today + timedelta(days=7)

        active_orders = db.query(Order).filter(
            Order.status.notin_([OrderStatus.completed, OrderStatus.cancelled]),
            Order.is_active == True,
        ).all()

        target_users = db.query(User).filter(
            User.is_active == True,
        ).all()
        # Filter to manager-level and above
        notify_users = [u for u in target_users if u.role.name in ("super_admin", "admin", "manager")]

        for order in active_orders:
            order_no = order.order_no or f"Order #{str(order.id)[:8]}"
            product = order.product_name or order.style_name or "Unnamed Product"

            # ── Ex-Factory Passed ─────────────────────────────
            if order.ex_factory_date and order.ex_factory_date < today:
                days_overdue = (today - order.ex_factory_date).days
                for u in notify_users:
                    if not _already_notified_today(db, u.id, None, "ex_factory_passed"):
                        db.add(Notification(
                            user_id=u.id,
                            title="🔴 Ex-Factory Date Passed",
                            message=f"PO {order_no} ({product}) is {days_overdue} day(s) past its ex-factory date ({order.ex_factory_date}).",
                            type="ex_factory_passed",
                            order_id=order.id,
                        ))

            # ── Ex-Factory Approaching (within 7 days) ────────
            elif order.ex_factory_date and today <= order.ex_factory_date <= in_7_days:
                days_left = (order.ex_factory_date - today).days
                for u in notify_users:
                    if not _already_notified_today(db, u.id, None, "ex_factory_approaching"):
                        db.add(Notification(
                            user_id=u.id,
                            title="🟡 Ex-Factory Approaching",
                            message=f"PO {order_no} ({product}) ex-factory date is in {days_left} day(s) on {order.ex_factory_date}.",
                            type="ex_factory_approaching",
                            order_id=order.id,
                        ))

            # ── Stage Overdue ─────────────────────────────────
            for stage in order.stages:
                if stage.status == StageStatus.completed or stage.status == StageStatus.skipped:
                    continue
                if not stage.target_date:
                    continue
                stage_target = stage.target_date.date() if hasattr(stage.target_date, 'date') else stage.target_date
                if stage_target < today:
                    days_late = (today - stage_target).days
                    stage_label = str(stage.stage_name.value).replace("_", " ").title()
                    for u in notify_users:
                        if not _already_notified_today(db, u.id, str(stage.id), "stage_overdue"):
                            db.add(Notification(
                                user_id=u.id,
                                title="🔴 Stage Overdue",
                                message=f"PO {order_no} — {stage_label} stage is {days_late} day(s) past its target date.",
                                type="stage_overdue",
                                order_id=order.id,
                                stage_id=stage.id,
                            ))

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Notification Scanner Error] {e}")
    finally:
        db.close()
