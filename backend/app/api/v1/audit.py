"""
Audit Stage API — handles audit records for completed production orders.
Supports before/after photos, document uploads, move-to-bulk, and mark-as-shipped.
"""
import os, shutil, uuid
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import require_roles, get_current_user
from app.models.user import RoleEnum, User
from app.models.order import Order, OrderAudit, TrackType, OrderStatus, Vendor
from app.utils.response import success_response

router = APIRouter(prefix="/audit", tags=["Audit"])

AllStaff = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager, RoleEnum.qc_officer])
ManagerAccess = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager])

UPLOAD_DIR = "uploads/audit"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_DOC_TYPES = {
    "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg", "image/png", "image/webp"
}


def _get_or_create_audit(db: Session, order_id: str) -> OrderAudit:
    audit = db.query(OrderAudit).filter(OrderAudit.order_id == order_id).first()
    if not audit:
        audit = OrderAudit(order_id=order_id, documents=[])
        db.add(audit)
        db.commit()
        db.refresh(audit)
    return audit


def _serialize_audit(audit: OrderAudit) -> dict:
    return {
        "id": str(audit.id),
        "order_id": str(audit.order_id),
        "before_photo": audit.before_photo,
        "after_photo": audit.after_photo,
        "documents": audit.documents or [],
        "new_po_number": audit.new_po_number,
        "new_vendor_id": str(audit.new_vendor_id) if audit.new_vendor_id else None,
        "new_vendor_name": audit.new_vendor.name if audit.new_vendor else None,
        "is_moved_to_bulk": audit.is_moved_to_bulk,
        "moved_to_bulk_order_id": str(audit.moved_to_bulk_order_id) if audit.moved_to_bulk_order_id else None,
        "is_shipped": audit.is_shipped,
        "notes": audit.notes,
    }


# ── GET audit record ────────────────────────────────────────────────────────

@router.get("/{order_id}", response_model=dict, summary="Get Audit Record")
def get_audit(order_id: str, db: Session = Depends(get_db), _=Depends(AllStaff)):
    audit = _get_or_create_audit(db, order_id)
    return success_response(data=_serialize_audit(audit))


# ── Upload before/after photo ───────────────────────────────────────────────

@router.post("/{order_id}/photo/{photo_type}", response_model=dict, summary="Upload Before/After Photo")
def upload_photo(
    order_id: str,
    photo_type: str,  # "before" or "after"
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(AllStaff),
):
    if photo_type not in ("before", "after"):
        raise HTTPException(400, "photo_type must be 'before' or 'after'")
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(400, "Only JPEG/PNG/WEBP images are allowed.")

    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    url = f"/api/uploads/audit/{filename}"
    audit = _get_or_create_audit(db, order_id)
    if photo_type == "before":
        audit.before_photo = url
    else:
        audit.after_photo = url
    db.commit()
    return success_response(data={"url": url}, message=f"{photo_type.capitalize()} photo uploaded.")


# ── Upload document ─────────────────────────────────────────────────────────

@router.post("/{order_id}/document", response_model=dict, summary="Upload Audit Document")
def upload_document(
    order_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(AllStaff),
):
    if file.content_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(400, "File type not allowed.")

    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    url = f"/api/uploads/audit/{filename}"
    audit = _get_or_create_audit(db, order_id)
    docs = list(audit.documents or [])
    docs.append({"name": file.filename, "url": url, "type": file.content_type})
    audit.documents = docs
    db.commit()
    return success_response(data={"name": file.filename, "url": url}, message="Document uploaded.")


# ── Move sampling order to bulk ─────────────────────────────────────────────

class MoveToBulkPayload(BaseModel):
    po_number: str
    vendor_id: Optional[str] = None  # If None, keep the same vendor


@router.post("/{order_id}/move-to-bulk", response_model=dict, summary="Promote Sample to Bulk")
def move_to_bulk(
    order_id: str,
    payload: MoveToBulkPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(ManagerAccess),
):
    sample = db.query(Order).filter(Order.id == order_id, Order.is_active == True).first()
    if not sample:
        raise HTTPException(404, "Sampling order not found.")
    if sample.track_type != TrackType.sampling:
        raise HTTPException(400, "Only sampling orders can be moved to bulk.")

    target_vendor_id = payload.vendor_id or str(sample.vendor_id)

    # Create a new bulk order mirroring the sample
    bulk_order = Order(
        vendor_id=target_vendor_id,
        order_no=payload.po_number,
        style_name=sample.product_name or sample.style_name,
        product_name=sample.product_name,
        product_type=sample.product_type,
        fabric=sample.fabric,
        quantity=sample.quantity,
        ex_factory_date=sample.ex_factory_date,
        priority=sample.priority,
        track_type=TrackType.bulk,
        requirements=sample.requirements,
        reference_image=sample.reference_image,
        parent_id=str(sample.id),
        created_by=str(current_user.id),
    )
    db.add(bulk_order)

    # Mark original sample as completed and deactivate
    sample.status = OrderStatus.completed
    sample.is_active = False

    # Update audit record
    audit = _get_or_create_audit(db, order_id)
    audit.new_po_number = payload.po_number
    audit.new_vendor_id = target_vendor_id
    audit.is_moved_to_bulk = True

    db.commit()
    db.refresh(bulk_order)
    audit.moved_to_bulk_order_id = str(bulk_order.id)
    db.commit()

    return success_response(
        data={"bulk_order_id": str(bulk_order.id), "po_number": payload.po_number},
        message="Sample promoted to Bulk Production successfully."
    )


# ── Mark bulk order as shipped ──────────────────────────────────────────────

@router.post("/{order_id}/mark-shipped", response_model=dict, summary="Mark Bulk Order as Shipped")
def mark_shipped(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(ManagerAccess),
):
    bulk_order = db.query(Order).filter(Order.id == order_id, Order.is_active == True).first()
    if not bulk_order:
        raise HTTPException(404, "Order not found.")

    bulk_order.status = OrderStatus.completed
    audit = _get_or_create_audit(db, order_id)
    audit.is_shipped = True
    db.commit()

    return success_response(message="Order marked as shipped and completed.")
