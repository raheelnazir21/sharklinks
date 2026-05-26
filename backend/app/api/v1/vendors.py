"""
Vendors API — CRUD for vendor management.
Only admin and manager can manage vendors.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import String, cast
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import require_roles, get_current_user
from app.models.user import RoleEnum, User
from app.models.order import Order, OrderStatus
from app.repositories.order_repo import _id_variants
from app.schemas.order import VendorCreate, VendorUpdate
from app.services.vendor_service import VendorService
from app.services.activity_log_service import ActivityLogService
from app.utils.response import success_response

router = APIRouter(prefix="/vendors", tags=["Vendors"])

ManagerAccess = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager, RoleEnum.qc_officer])


@router.get("", response_model=dict, summary="List All Vendors")
@router.get("/", response_model=dict, summary="List All Vendors")
def list_vendors(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    search: str = Query("", description="Search by vendor name"),
    db: Session = Depends(get_db),
    _=Depends(ManagerAccess),
):
    vendors = VendorService.list_vendors(db, skip=skip, limit=limit, search=search)
    return success_response(data=[
        {
            "id": str(c.id), "name": c.name, "contact_person": c.contact_person,
            "email": c.email, "phone": c.phone, "country": c.country,
            "total_orders": getattr(c, "total_orders", 0),
        }
        for c in vendors
    ])


@router.post("", response_model=dict, summary="Create Vendor")
@router.post("/", response_model=dict, summary="Create Vendor")
def create_vendor(
    payload: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(ManagerAccess),
):
    vendor = VendorService.create_vendor(db, payload)
    ActivityLogService.record(
        db,
        action="VENDOR_CREATED",
        entity_type="Vendor",
        entity_id=str(vendor.id),
        user=current_user,
        payload={"details": f"Vendor '{vendor.name}' was created."},
    )
    return success_response(
        data={"id": str(vendor.id), "name": vendor.name},
        message="Vendor created successfully."
    )


@router.get("/{vendor_id}", response_model=dict, summary="Get Vendor Detail")
def get_vendor(
    vendor_id: str,
    db: Session = Depends(get_db),
    _=Depends(ManagerAccess),
):
    vendor = VendorService.get_vendor(db, vendor_id)
    return success_response(data={
        "id": str(vendor.id), "name": vendor.name,
        "contact_person": vendor.contact_person,
        "email": vendor.email, "phone": vendor.phone,
        "country": vendor.country, "address": vendor.address,
    })


@router.put("/{vendor_id}", response_model=dict, summary="Update Vendor")
def update_vendor(
    vendor_id: str,
    payload: VendorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(ManagerAccess),
):
    VendorService.update_vendor(db, vendor_id, payload)
    ActivityLogService.record(
        db,
        action="VENDOR_UPDATED",
        entity_type="Vendor",
        entity_id=vendor_id,
        user=current_user,
        payload={"details": "Vendor profile was updated."},
    )
    return success_response(message="Vendor updated successfully.")


@router.delete("/{vendor_id}", response_model=dict, summary="Deactivate Vendor")
def delete_vendor(
    vendor_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(ManagerAccess),
):
    vendor = VendorService.delete_vendor(db, vendor_id)
    affected_orders = db.query(Order).filter(
        cast(Order.vendor_id, String).in_(_id_variants(str(vendor.id))),
        Order.is_active == True,
    ).all()
    for order in affected_orders:
        order.status = OrderStatus.cancelled
        order.is_active = False
    db.commit()
    ActivityLogService.record(
        db,
        action="VENDOR_DEACTIVATED",
        entity_type="Vendor",
        entity_id=vendor_id,
        user=current_user,
        payload={"details": f"Vendor was deactivated with {len(affected_orders)} active order(s)."},
    )
    return success_response(message="Vendor and related active orders deactivated successfully.")
