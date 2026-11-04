"""
Pre-Order Service — Business logic for the "Orders to Process" module.
Handles CRUD, email dispatch, and the reminder/escalation scheduler scan.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import HTTPException, BackgroundTasks
from sqlalchemy import cast, String
from sqlalchemy.orm import Session

from app.models.pre_order_request import PreOrderRequest, PreOrderStatus
from app.models.user import User, RoleEnum
from app.models.order import Vendor
from app.schemas.pre_order import PreOrderCreate, PreOrderUpdate, PreOrderProceed, PreOrderInitializeClass
from app.core.database import SessionLocal

logger = logging.getLogger(__name__)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _serialize(
    req: PreOrderRequest,
    db: Session,
    user_map: Optional[dict] = None,
    vendor_map: Optional[dict] = None,
) -> dict:
    """Convert a PreOrderRequest ORM object to a serializable dict with joined names."""
    # Load related names (utilizing preloaded maps to eliminate N+1 query loops)
    if user_map is not None:
        manager = user_map.get(str(req.assigned_manager_id)) if req.assigned_manager_id else None
        assigned_by = user_map.get(str(req.assigned_by_id)) if req.assigned_by_id else None
    else:
        manager = db.query(User).filter(User.id == req.assigned_manager_id).first()
        assigned_by = db.query(User).filter(User.id == req.assigned_by_id).first()

    if vendor_map is not None:
        vendor = vendor_map.get(str(req.vendor_id)) if req.vendor_id else None
    else:
        vendor = db.query(Vendor).filter(Vendor.id == req.vendor_id).first() if req.vendor_id else None

    hours_elapsed = None
    days_elapsed = None
    if req.assigned_at:
        delta = datetime.utcnow() - req.assigned_at
        hours_elapsed = round(delta.total_seconds() / 3600, 1)
        days_elapsed = round(delta.total_seconds() / 86400, 1)

    # ── Auto-sync class and order count from database ─────────────────────────
    category_str = req.category.value if hasattr(req.category, "value") else str(req.category)
    is_bulk = category_str == "bulk"
    linked_class_id = str(req.linked_class_id) if getattr(req, "linked_class_id", None) else None

    try:
        from app.models.order import BulkClass, SampleClass, Order
        if not linked_class_id and req.class_name:
            if is_bulk:
                matched_c = db.query(BulkClass).filter(BulkClass.name == req.class_name).first()
                if matched_c:
                    linked_class_id = str(matched_c.id)
                    req.linked_class_id = linked_class_id
            else:
                matched_c = db.query(SampleClass).filter(SampleClass.name == req.class_name).first()
                if matched_c:
                    linked_class_id = str(matched_c.id)
                    req.linked_class_id = linked_class_id

        if linked_class_id:
            try:
                with db.begin_nested():
                    if is_bulk:
                        orders_in_class = db.query(Order).filter(Order.bulk_class_id == linked_class_id, Order.is_active == True).all()
                    else:
                        orders_in_class = db.query(Order).filter(Order.sample_class_id == linked_class_id, Order.is_active == True).all()

                    actual_orders_count = len(orders_in_class)
                    req.processed_product_count = actual_orders_count

                    if orders_in_class:
                        po_numbers = [o.order_no for o in orders_in_class if o.order_no]
                        req.linked_order_id = ", ".join(po_numbers)[:500]

                    total_needed = req.total_product_count or 1
                    if (req.processed_product_count or 0) >= total_needed:
                        req.status = PreOrderStatus.processed
                    elif (req.processed_product_count or 0) > 0 and req.status != PreOrderStatus.ignored:
                        req.status = PreOrderStatus.partial
                    db.flush()
                db.commit()
            except Exception as sync_err:
                logger.warning(f"[_serialize] Failed to sync class order count: {sync_err}")
    except Exception as e:
        logger.warning(f"[_serialize] Failed to sync class order count: {e}")

    return {
        "id": str(getattr(req, "id", "")),
        "class_name": getattr(req, "class_name", "") or "",
        "category": req.category.value if hasattr(getattr(req, "category", None), "value") else str(getattr(req, "category", "bulk")),
        "style_name": getattr(req, "style_name", None),
        "customer": getattr(req, "customer", None),
        "reference_po": getattr(req, "reference_po", None),
        "quantity": getattr(req, "quantity", None),
        "total_product_count": getattr(req, "total_product_count", 1) or 1,
        "processed_product_count": getattr(req, "processed_product_count", 0) or 0,
        "ex_factory_date": str(req.ex_factory_date) if getattr(req, "ex_factory_date", None) else None,
        "priority": req.priority.value if hasattr(getattr(req, "priority", None), "value") else str(getattr(req, "priority", "normal")),
        "notes": getattr(req, "notes", None),
        "vendor_id": str(req.vendor_id) if getattr(req, "vendor_id", None) else None,
        "vendor_name": vendor.name if vendor else None,
        "assigned_manager_id": str(getattr(req, "assigned_manager_id", "")),
        "assigned_manager_name": manager.full_name if manager else None,
        "assigned_manager_email": manager.email if manager else None,
        "assigned_by_id": str(getattr(req, "assigned_by_id", "")),
        "assigned_by_name": assigned_by.full_name if assigned_by else None,
        "assigned_at": req.assigned_at.isoformat() if getattr(req, "assigned_at", None) else None,
        "linked_class_id": linked_class_id,
        "linked_order_id": str(getattr(req, "linked_order_id", "")) if getattr(req, "linked_order_id", None) else None,
        "linked_at": req.linked_at.isoformat() if getattr(req, "linked_at", None) else None,
        "status": req.status.value if hasattr(getattr(req, "status", None), "value") else str(getattr(req, "status", "pending")),
        "ignore_reason": getattr(req, "ignore_reason", None),
        "hours_elapsed": hours_elapsed,
        "days_elapsed": days_elapsed,
        "assignment_email_sent_at": req.assignment_email_sent_at.isoformat() if getattr(req, "assignment_email_sent_at", None) else None,
        "first_reminder_sent_at": req.first_reminder_sent_at.isoformat() if getattr(req, "first_reminder_sent_at", None) else None,
        "second_reminder_sent_at": req.second_reminder_sent_at.isoformat() if getattr(req, "second_reminder_sent_at", None) else None,
        "escalation_sent_at": req.escalation_sent_at.isoformat() if getattr(req, "escalation_sent_at", None) else None,
        "created_at": req.created_at.isoformat() if getattr(req, "created_at", None) else None,
        "updated_at": req.updated_at.isoformat() if getattr(req, "updated_at", None) else None,
    }


def _get_admin_emails(db: Session) -> list[str]:
    """Return email addresses of all active admins and super_admins."""
    users = db.query(User).filter(User.is_active == True).all()
    emails = []
    for u in users:
        role_name = ""
        if u.role:
            role_name = str(getattr(u.role, "name", "") or "").lower()
            if hasattr(u.role.name, "value"):
                role_name = str(u.role.name.value).lower()
        if any(r in role_name for r in ("super_admin", "admin")):
            if u.email:
                emails.append(u.email)
    return list(set(emails))


def _get_super_admin_emails(db: Session) -> list[str]:
    """Return email addresses of super_admins only."""
    users = db.query(User).filter(User.is_active == True).all()
    emails = []
    for u in users:
        role_name = ""
        if u.role:
            role_name = str(getattr(u.role, "name", "") or "").lower()
            if hasattr(u.role.name, "value"):
                role_name = str(u.role.name.value).lower()
        if "super_admin" in role_name and u.email:
            emails.append(u.email)
    for fallback in [
        "faisalaslam1038@gmail.com",
        "qc@cottoncollective.org",
        "raheel.safelife@gmail.com",
        "david@cottoncollective.org",
        "casey@domesticconception.com",
    ]:
        if fallback not in emails:
            emails.append(fallback)
    return list(dict.fromkeys(emails))


def _send_assignment_email_task(req_id: str, serialized: dict, manager_email: str, cc: list[str]) -> None:
    """Background task to dispatch assignment email and update DB timestamp without blocking HTTP response."""
    try:
        from app.services.email_service import send_assignment_email
        send_assignment_email(serialized, manager_email, cc)
        try:
            with SessionLocal() as bg_db:
                bg_req = bg_db.query(PreOrderRequest).filter(cast(PreOrderRequest.id, String) == str(req_id)).first()
                if bg_req:
                    bg_req.assignment_email_sent_at = datetime.utcnow()
                    bg_db.commit()
        except Exception as db_email_err:
            logger.warning(f"[BackgroundTasks] Failed to record assignment email timestamp for {req_id}: {db_email_err}")
    except Exception as e:
        logger.error(f"[BackgroundTasks] Assignment email failed for {req_id}: {e}")


# ─── CRUD ────────────────────────────────────────────────────────────────────

class PreOrderService:

    @staticmethod
    def create(
        db: Session,
        payload: PreOrderCreate,
        current_user: User,
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> dict:
        # Validate manager exists
        manager = db.query(User).filter(
            User.id == payload.assigned_manager_id,
            User.is_active == True,
        ).first()
        if not manager:
            raise HTTPException(status_code=400, detail="Assigned manager not found or inactive.")

        req = PreOrderRequest(
            class_name=payload.class_name,
            category=payload.category,
            style_name=payload.style_name,
            customer=payload.customer,
            reference_po=payload.reference_po,
            quantity=payload.quantity,
            total_product_count=max(1, payload.total_product_count or 1),
            processed_product_count=0,
            ex_factory_date=payload.ex_factory_date,
            priority=payload.priority,
            notes=payload.notes,
            vendor_id=payload.vendor_id,
            assigned_manager_id=payload.assigned_manager_id,
            assigned_by_id=str(current_user.id),
            status=PreOrderStatus.pending,
        )
        db.add(req)
        db.commit()
        db.refresh(req)

        # ── Fire assignment email (BackgroundTasks if available, else inline) ──
        try:
            serialized = _serialize(req, db)
            admin_emails = _get_admin_emails(db)
            # CC = all admins except the manager (avoid duplicate TO/CC)
            cc = [e for e in admin_emails if e != manager.email]
            if current_user.email and current_user.email not in cc and current_user.email != manager.email:
                cc.append(current_user.email)

            if manager.email:
                if background_tasks:
                    background_tasks.add_task(
                        _send_assignment_email_task, str(req.id), serialized, manager.email, cc
                    )
                else:
                    _send_assignment_email_task(str(req.id), serialized, manager.email, cc)
        except Exception as e:
            logger.error(f"[PreOrderService] Assignment email scheduling failed: {e}")

        # ── In-app notification to manager ────────────────────────────────
        try:
            from app.models.comments_notifications import Notification
            cat_name = req.category.value if hasattr(req.category, "value") else str(req.category)
            with db.begin_nested():
                notif_title = f"New Order Assigned: {req.class_name}"
                if len(notif_title) > 450:
                    notif_title = notif_title[:447] + "..."
                db.add(Notification(
                    user_id=req.assigned_manager_id,
                    title=notif_title,
                    message=f"You have been assigned a new {cat_name} order: {req.class_name}. Please process it in the system.",
                    category="pre_order_assigned",
                    type="pre_order_assigned",
                    extra_data={"pre_order_id": str(req.id), "class_name": req.class_name},
                ))
                db.flush()
            db.commit()
        except Exception as e:
            logger.error(f"[PreOrderService] In-app notification failed: {e}")

        return _serialize(req, db)

    @staticmethod
    def list_all(
        db: Session,
        current_user: User,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[dict]:
        query = db.query(PreOrderRequest)

        # Managers only see their own assigned pre-orders
        role_name = ""
        if current_user.role:
            role_name = str(getattr(current_user.role, "name", "") or "").lower()
            if hasattr(current_user.role.name, "value"):
                role_name = str(current_user.role.name.value).lower()

        is_admin = any(r in role_name for r in ("super_admin", "admin"))
        if not is_admin:
            query = query.filter(PreOrderRequest.assigned_manager_id == current_user.id)

        if status:
            query = query.filter(PreOrderRequest.status == status)

        reqs = query.order_by(PreOrderRequest.created_at.desc()).offset(skip).limit(limit).all()
        if not reqs:
            return []

        # Batch preload users and vendors to eliminate N+1 queries during serialization
        user_ids = {str(r.assigned_manager_id) for r in reqs if r.assigned_manager_id} | {
            str(r.assigned_by_id) for r in reqs if r.assigned_by_id
        }
        vendor_ids = {str(r.vendor_id) for r in reqs if r.vendor_id}

        users = db.query(User).filter(cast(User.id, String).in_(list(user_ids))).all() if user_ids else []
        user_map = {str(u.id): u for u in users}

        vendors = db.query(Vendor).filter(cast(Vendor.id, String).in_(list(vendor_ids))).all() if vendor_ids else []
        vendor_map = {str(v.id): v for v in vendors}

        return [_serialize(r, db, user_map=user_map, vendor_map=vendor_map) for r in reqs]

    @staticmethod
    def get(db: Session, pre_order_id: str, current_user: User) -> dict:
        req = db.query(PreOrderRequest).filter(PreOrderRequest.id == pre_order_id).first()
        if not req:
            raise HTTPException(status_code=404, detail="Pre-order request not found.")
        role_name = ""
        if current_user.role:
            role_name = str(getattr(current_user.role, "name", "") or "").lower()
            if hasattr(current_user.role.name, "value"):
                role_name = str(current_user.role.name.value).lower()
        is_admin = any(r in role_name for r in ("super_admin", "admin"))
        if not is_admin and str(req.assigned_manager_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied: You can only view your own assigned orders.")
        return _serialize(req, db)

    @staticmethod
    def update(db: Session, pre_order_id: str, payload: PreOrderUpdate, current_user: User) -> dict:
        req = db.query(PreOrderRequest).filter(PreOrderRequest.id == pre_order_id).first()
        if not req:
            raise HTTPException(status_code=404, detail="Pre-order request not found.")
        if req.status == PreOrderStatus.processed:
            raise HTTPException(status_code=400, detail="Cannot edit a processed pre-order.")

        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(req, field, value)
        db.commit()
        return _serialize(req, db)

    @staticmethod
    def link_order(db: Session, pre_order_id: str, order_id: str, current_user: User, products_count: int = 1) -> dict:
        """Mark a pre-order as processed or partial by linking it to an actual order."""
        req = db.query(PreOrderRequest).filter(PreOrderRequest.id == pre_order_id).first()
        if not req:
            raise HTTPException(status_code=404, detail="Pre-order request not found.")

        added_count = max(1, products_count or 1)
        req.processed_product_count = (req.processed_product_count or 0) + added_count

        if not req.linked_order_id:
            req.linked_order_id = order_id
        else:
            existing_pos = [p.strip() for p in req.linked_order_id.split(",") if p.strip()]
            if order_id not in existing_pos:
                existing_pos.append(order_id)
            req.linked_order_id = ", ".join(existing_pos)

        req.linked_at = datetime.utcnow()
        req.linked_by_id = str(current_user.id)

        total_needed = req.total_product_count or 1
        if req.processed_product_count >= total_needed:
            req.status = PreOrderStatus.processed
            notif_title = f"Order Completed: {req.class_name}"
            notif_msg = f"All {total_needed} products have been added and order is fully processed by {current_user.full_name}."
        else:
            req.status = PreOrderStatus.partial
            notif_title = f"Order Partially Processed: {req.class_name}"
            notif_msg = f"{req.processed_product_count} of {total_needed} products added by {current_user.full_name}. Status is Partial ({total_needed - req.processed_product_count} remaining)."

        db.commit()

        # In-app notification to assigned_by user
        try:
            from app.models.comments_notifications import Notification
            db.add(Notification(
                user_id=req.assigned_by_id,
                title=notif_title,
                message=notif_msg,
                category="pre_order_processed",
                type="pre_order_processed",
                extra_data={"pre_order_id": str(req.id), "order_id": order_id},
            ))
            db.commit()
        except Exception as e:
            logger.error(f"[PreOrderService] Processed notification failed: {e}")

        return _serialize(req, db)

    @staticmethod
    def ignore(db: Session, pre_order_id: str, reason: Optional[str], current_user: User) -> dict:
        req = db.query(PreOrderRequest).filter(PreOrderRequest.id == pre_order_id).first()
        if not req:
            raise HTTPException(status_code=404, detail="Pre-order request not found.")
        req.status = PreOrderStatus.ignored
        req.ignore_reason = reason
        db.commit()
        return _serialize(req, db)

    @staticmethod
    def delete(db: Session, pre_order_id: str, current_user: User) -> None:
        req = db.query(PreOrderRequest).filter(PreOrderRequest.id == pre_order_id).first()
        if not req:
            raise HTTPException(status_code=404, detail="Pre-order request not found.")
        db.delete(req)
        db.commit()

    @staticmethod
    def initialize_class(
        db: Session,
        pre_order_id: str,
        current_user: User,
        payload: Optional[PreOrderInitializeClass] = None,
    ) -> dict:
        """
        Creates or retrieves the master BulkClass or SampleClass for this pre-order,
        links it to req.linked_class_id, and returns the redirect URL to the Order Workspace
        so the manager can add orders inside the class directly with their own specifications.
        """
        req = db.query(PreOrderRequest).filter(PreOrderRequest.id == pre_order_id).first()
        if not req:
            raise HTTPException(status_code=404, detail="Pre-order request not found.")

        role_name = ""
        if current_user.role:
            role_name = str(getattr(current_user.role, "name", "") or "").lower()
            if hasattr(current_user.role.name, "value"):
                role_name = str(current_user.role.name.value).lower()
        is_admin = any(r in role_name for r in ("super_admin", "admin"))
        if not is_admin and str(req.assigned_manager_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied: You can only manage your own assigned orders.")

        category_str = req.category.value if hasattr(req.category, "value") else str(req.category)
        is_bulk = category_str == "bulk"

        from app.models.order import BulkClass, SampleClass

        # Extract values from payload or fallback to req
        class_name = ((payload.class_name.strip() if payload and payload.class_name else "") or req.class_name).strip()
        customer = ((payload.customer.strip() if payload and payload.customer else "") or req.customer or "").strip()
        serial_number = ((payload.serial_number.strip() if payload and payload.serial_number else "") or req.reference_po or f"CLS-{datetime.utcnow().strftime('%y%m%d%H%M')}").strip()
        vendor_id = (payload.vendor_id if payload and payload.vendor_id else None) or req.vendor_id
        remarks = (payload.remarks if payload and payload.remarks else None) or req.notes

        if vendor_id and not req.vendor_id:
            req.vendor_id = vendor_id
        if class_name:
            req.class_name = class_name
        if customer and not req.customer:
            req.customer = customer

        class_id = str(req.linked_class_id) if req.linked_class_id else None

        if is_bulk:
            bulk_class = None
            if class_id:
                bulk_class = db.query(BulkClass).filter(BulkClass.id == class_id).first()
            if not bulk_class and class_name:
                bulk_class = db.query(BulkClass).filter(BulkClass.name == class_name).first()
            if not bulk_class:
                bulk_class = BulkClass(
                    name=class_name,
                    serial_number=serial_number,
                    customer=customer,
                    vendor_id=vendor_id,
                    remarks=remarks,
                    created_by=str(current_user.id),
                )
                db.add(bulk_class)
                db.flush()
            else:
                if vendor_id and not bulk_class.vendor_id:
                    bulk_class.vendor_id = vendor_id
                if customer and not bulk_class.customer:
                    bulk_class.customer = customer
            class_id = str(bulk_class.id)
            req.linked_class_id = class_id
        else:
            sample_class = None
            if class_id:
                sample_class = db.query(SampleClass).filter(SampleClass.id == class_id).first()
            if not sample_class and class_name:
                sample_class = db.query(SampleClass).filter(SampleClass.name == class_name).first()
            if not sample_class:
                sample_class = SampleClass(
                    name=class_name,
                    serial_number=serial_number,
                    customer=customer,
                    vendor_id=vendor_id,
                    remarks=remarks,
                    created_by=str(current_user.id),
                )
                db.add(sample_class)
                db.flush()
            else:
                if vendor_id and not sample_class.vendor_id:
                    sample_class.vendor_id = vendor_id
                if customer and not sample_class.customer:
                    sample_class.customer = customer
            class_id = str(sample_class.id)
            req.linked_class_id = class_id

        db.commit()

        track = "bulk" if is_bulk else "sampling"
        param_name = "bulk_class_id" if is_bulk else "sample_class_id"
        redirect_url = f"/orders?track={track}&{param_name}={class_id}"

        return {
            "success": True,
            "class_id": class_id,
            "class_name": class_name,
            "track": track,
            "redirect_url": redirect_url,
            "pre_order": _serialize(req, db),
        }

    @staticmethod
    def proceed_to_order(db: Session, pre_order_id: str, payload: PreOrderProceed, current_user: User) -> dict:
        """Converts/proceeds a pre-order request into an actual production order."""
        req = db.query(PreOrderRequest).filter(PreOrderRequest.id == pre_order_id).first()
        if not req:
            raise HTTPException(status_code=404, detail="Pre-order request not found.")
        if req.status == PreOrderStatus.processed:
            raise HTTPException(status_code=400, detail="This pre-order has already been processed.")

        # Permissions: admin or the assigned manager can proceed
        role_name = ""
        if current_user.role:
            role_name = str(getattr(current_user.role, "name", "") or "").lower()
            if hasattr(current_user.role.name, "value"):
                role_name = str(current_user.role.name.value).lower()
        is_admin = any(r in role_name for r in ("super_admin", "admin"))
        if not is_admin and str(req.assigned_manager_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied: You can only proceed your own assigned orders.")

        vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()
        if not vendor or not vendor.is_active:
            raise HTTPException(status_code=400, detail="Selected vendor is not active or does not exist.")

        category_str = req.category.value if hasattr(req.category, "value") else str(req.category)
        is_bulk = category_str == "bulk"

        from app.models.order import BulkClass, SampleClass, Order
        bulk_class_id = None
        sample_class_id = None

        if is_bulk:
            bulk_class = None
            if req.linked_class_id:
                bulk_class = db.query(BulkClass).filter(BulkClass.id == req.linked_class_id).first()
            if not bulk_class:
                bulk_class = db.query(BulkClass).filter(BulkClass.name == req.class_name).first()
            if not bulk_class:
                bulk_class = BulkClass(
                    name=req.class_name,
                    serial_number=req.reference_po or payload.order_no or f"CLS-{datetime.utcnow().strftime('%y%m%d%H%M')}",
                    customer=req.customer,
                    vendor_id=vendor.id,
                    created_by=str(current_user.id),
                )
                db.add(bulk_class)
                db.flush()
            bulk_class_id = str(bulk_class.id)
            req.linked_class_id = bulk_class_id
        else:
            sample_class = None
            if req.linked_class_id:
                sample_class = db.query(SampleClass).filter(SampleClass.id == req.linked_class_id).first()
            if not sample_class:
                sample_class = db.query(SampleClass).filter(SampleClass.name == req.class_name).first()
            if not sample_class:
                sample_class = SampleClass(
                    name=req.class_name,
                    serial_number=req.reference_po or payload.order_no or f"CLS-{datetime.utcnow().strftime('%y%m%d%H%M')}",
                    customer=req.customer,
                    vendor_id=vendor.id,
                    created_by=str(current_user.id),
                )
                db.add(sample_class)
                db.flush()
            sample_class_id = str(sample_class.id)
            req.linked_class_id = sample_class_id

        from app.schemas.order import OrderCreate, OrderPriority, TrackType
        from app.services.order_service import OrderService
        from datetime import date

        # Distinct order specifications — do NOT default to req.class_name
        current_count = req.processed_product_count or 0
        order_no = (payload.order_no or "").strip() or req.reference_po or f"PO-{datetime.utcnow().strftime('%y%m%d%H%M')}"
        style_name = (payload.style_name or "").strip() or (req.style_name or "").strip() or f"Style {current_count + 1}"
        product_name = (payload.product_name or "").strip() or style_name
        quantity = payload.quantity or req.quantity or 1
        
        priority_val = "normal"
        if payload.priority:
            priority_val = payload.priority.value if hasattr(payload.priority, "value") else str(payload.priority)
        elif req.priority:
            priority_val = req.priority.value if hasattr(req.priority, "value") else str(req.priority)

        order_create_payload = OrderCreate(
            vendor_id=str(vendor.id),
            order_no=order_no,
            style_name=style_name,
            product_name=product_name,
            product_type=payload.product_type,
            fabric=payload.fabric,
            tech_pack_no=payload.tech_pack_no,
            quantity=quantity,
            ex_factory_date=payload.ex_factory_date,
            order_placement_date=payload.order_placement_date or date.today(),
            priority=OrderPriority(priority_val),
            track_type=TrackType.bulk if is_bulk else TrackType.sampling,
            bulk_class_id=bulk_class_id,
            sample_class_id=sample_class_id,
            remarks=payload.remarks or req.notes,
            requirements=payload.requirements,
        )

        order = OrderService.create_order(db, order_create_payload, str(current_user.id))

        # Query all live active orders in this class to update exact live count
        if is_bulk:
            orders_in_class = db.query(Order).filter(Order.bulk_class_id == bulk_class_id, Order.is_active == True).all()
        else:
            orders_in_class = db.query(Order).filter(Order.sample_class_id == sample_class_id, Order.is_active == True).all()

        req.processed_product_count = len(orders_in_class)
        po_numbers = [o.order_no for o in orders_in_class if o.order_no]
        req.linked_order_id = ", ".join(po_numbers)
        req.linked_at = datetime.utcnow()
        req.linked_by_id = str(current_user.id)

        # Check against total_product_count
        total_needed = req.total_product_count or 1
        if req.processed_product_count >= total_needed:
            req.status = PreOrderStatus.processed
            notif_title = f"Order Fully Launched: {req.class_name}"
            notif_msg = f"All {total_needed} products have been added and order is fully live in production (PO: {order.order_no})."
        else:
            req.status = PreOrderStatus.partial
            notif_title = f"Order Partially Launched: {req.class_name}"
            notif_msg = f"{req.processed_product_count} of {total_needed} products added by {current_user.full_name} (PO: {order.order_no}). Status is Partial ({total_needed - req.processed_product_count} remaining)."

        db.commit()

        # In-app notification to the person who assigned the pre-order
        try:
            from app.models.comments_notifications import Notification
            db.add(Notification(
                user_id=req.assigned_by_id,
                title=notif_title,
                message=notif_msg,
                category="order_launched",
                type="order_launched",
                extra_data={"pre_order_id": str(req.id), "order_id": str(order.id), "order_no": order.order_no},
            ))
            db.commit()
        except Exception as e:
            logger.error(f"[PreOrderService] Launch notification error: {e}")

        return {
            "pre_order": _serialize(req, db),
            "order": {
                "id": str(order.id),
                "order_no": order.order_no,
                "track_type": order.track_type.value,
                "bulk_class_id": bulk_class_id,
                "sample_class_id": sample_class_id,
            }
        }


# ─── Scheduler — Reminder & Escalation Scan ──────────────────────────────────

def run_pre_order_reminder_scan() -> None:
    """
    Runs every hour via APScheduler.
    Finds pending pre-orders and sends reminders / escalations based on elapsed time.
    Deduplicates — each tier fires only once.
    """
    from app.core.config import settings
    reminder_1h = int(getattr(settings, "ORDER_REMINDER_HOURS_1", 24))
    reminder_2h = int(getattr(settings, "ORDER_REMINDER_HOURS_2", 48))
    escalation_h = int(getattr(settings, "ORDER_ESCALATION_HOURS", 72))

    db: Session = SessionLocal()
    try:
        pending = db.query(PreOrderRequest).filter(
            PreOrderRequest.status == PreOrderStatus.pending
        ).all()

        for req in pending:
            if not req.assigned_at:
                continue

            hours_elapsed = (datetime.utcnow() - req.assigned_at).total_seconds() / 3600
            serialized = _serialize(req, db)

            manager = db.query(User).filter(User.id == req.assigned_manager_id).first()
            if not manager or not manager.email:
                continue

            admin_emails = _get_admin_emails(db)
            cc = [e for e in admin_emails if e != manager.email]

            # Mark overdue in DB
            if hours_elapsed >= reminder_2h and req.status != PreOrderStatus.overdue:
                req.status = PreOrderStatus.overdue

            # ── Escalation (72h) ──
            if hours_elapsed >= escalation_h and not req.escalation_sent_at:
                try:
                    from app.services.email_service import send_escalation_email
                    super_admin_emails = _get_super_admin_emails(db)
                    if super_admin_emails:
                        send_escalation_email(serialized, super_admin_emails, cc)
                    req.escalation_sent_at = datetime.utcnow()
                    # In-app notification for all admins
                    from app.models.comments_notifications import Notification
                    for u in db.query(User).filter(User.is_active == True).all():
                        r = str(getattr(u.role, "name", "") or "").lower() if u.role else ""
                        if any(x in r for x in ("super_admin", "admin")):
                            db.add(Notification(
                                user_id=u.id,
                                title=f"🚨 ESCALATION: {req.class_name} — 72h Unprocessed",
                                message=f"Pre-order '{req.class_name}' assigned to {serialized.get('assigned_manager_name','Manager')} has not been processed for 72+ hours.",
                                category="pre_order_escalation",
                                type="pre_order_escalation",
                                extra_data={"pre_order_id": str(req.id)},
                            ))
                except Exception as e:
                    logger.error(f"[PreOrderReminder] Escalation failed for {req.id}: {e}")

            # ── 2nd Reminder (48h) ──
            elif hours_elapsed >= reminder_2h and not req.second_reminder_sent_at:
                try:
                    from app.services.email_service import send_reminder_email
                    send_reminder_email(serialized, manager.email, cc, reminder_num=2, hours_overdue=int(hours_elapsed))
                    req.second_reminder_sent_at = datetime.utcnow()
                    from app.models.comments_notifications import Notification
                    db.add(Notification(
                        user_id=req.assigned_manager_id,
                        title=f"🔴 2nd Reminder: {req.class_name} — Urgent",
                        message=f"Order '{req.class_name}' has not been processed for {int(hours_elapsed)} hours. Final reminder before escalation.",
                        category="pre_order_reminder",
                        type="pre_order_reminder",
                        extra_data={"pre_order_id": str(req.id), "reminder_num": 2},
                    ))
                except Exception as e:
                    logger.error(f"[PreOrderReminder] 2nd reminder failed for {req.id}: {e}")

            # ── 1st Reminder (24h) ──
            elif hours_elapsed >= reminder_1h and not req.first_reminder_sent_at:
                try:
                    from app.services.email_service import send_reminder_email
                    send_reminder_email(serialized, manager.email, cc, reminder_num=1, hours_overdue=int(hours_elapsed))
                    req.first_reminder_sent_at = datetime.utcnow()
                    from app.models.comments_notifications import Notification
                    db.add(Notification(
                        user_id=req.assigned_manager_id,
                        title=f"🟠 Reminder: {req.class_name} — Not Yet Processed",
                        message=f"Order '{req.class_name}' was assigned {int(hours_elapsed)} hours ago. Please create it in the system.",
                        category="pre_order_reminder",
                        type="pre_order_reminder",
                        extra_data={"pre_order_id": str(req.id), "reminder_num": 1},
                    ))
                except Exception as e:
                    logger.error(f"[PreOrderReminder] 1st reminder failed for {req.id}: {e}")

        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[PreOrderReminder] Scan error: {e}")
    finally:
        db.close()
