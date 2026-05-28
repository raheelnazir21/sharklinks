"""
Vendor Service — business logic for vendor management.
Sits between the API route and the repository.
"""
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories.vendor_repo import VendorRepository
from app.schemas.order import VendorCreate, VendorUpdate
from app.models.order import Vendor


class VendorService:

    @staticmethod
    def list_vendors(db: Session, skip: int, limit: int, search: str, assigned_manager_id: Optional[str] = None) -> List[Vendor]:
        vendors = VendorRepository.get_all(db, skip=skip, limit=limit, search=search, assigned_manager_id=assigned_manager_id)
        # Attach order count to each vendor
        for vendor in vendors:
            vendor.total_orders = len([o for o in vendor.orders if o.is_active])
        return vendors

    @staticmethod
    def get_vendor(db: Session, vendor_id: str) -> Vendor:
        vendor = VendorRepository.get_by_id(db, vendor_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found.")
        return vendor

    @staticmethod
    def create_vendor(db: Session, payload: VendorCreate, user_id: Optional[str] = None, is_admin: bool = False) -> Vendor:
        existing = VendorRepository.get_by_name(db, payload.name)
        if existing:
            raise HTTPException(status_code=400, detail="A vendor with this name already exists.")
        data = payload.model_dump()
        if data.get("assigned_manager_id") == "":
            data["assigned_manager_id"] = None
        if not is_admin:
            data["assigned_manager_id"] = user_id
        elif not data.get("assigned_manager_id"):
            data["assigned_manager_id"] = None
        return VendorRepository.create(db, data)

    @staticmethod
    def update_vendor(db: Session, vendor_id: str, payload: VendorUpdate) -> Vendor:
        vendor = VendorRepository.get_by_id(db, vendor_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found.")
        data = payload.model_dump(exclude_none=True)
        if data.get("assigned_manager_id") == "":
            data["assigned_manager_id"] = None
        return VendorRepository.update(db, vendor, data)

    @staticmethod
    def delete_vendor(db: Session, vendor_id: str) -> Vendor:
        vendor = VendorRepository.get_by_id(db, vendor_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found.")
        return VendorRepository.soft_delete(db, vendor)
