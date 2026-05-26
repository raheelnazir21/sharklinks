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
    def list_vendors(db: Session, skip: int, limit: int, search: str) -> List[Vendor]:
        vendors = VendorRepository.get_all(db, skip=skip, limit=limit, search=search)
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
    def create_vendor(db: Session, payload: VendorCreate) -> Vendor:
        existing = VendorRepository.get_by_name(db, payload.name)
        if existing:
            raise HTTPException(status_code=400, detail="A vendor with this name already exists.")
        return VendorRepository.create(db, payload.model_dump())

    @staticmethod
    def update_vendor(db: Session, vendor_id: str, payload: VendorUpdate) -> Vendor:
        vendor = VendorRepository.get_by_id(db, vendor_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found.")
        return VendorRepository.update(db, vendor, payload.model_dump(exclude_none=True))

    @staticmethod
    def delete_vendor(db: Session, vendor_id: str) -> Vendor:
        vendor = VendorRepository.get_by_id(db, vendor_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found.")
        return VendorRepository.soft_delete(db, vendor)
