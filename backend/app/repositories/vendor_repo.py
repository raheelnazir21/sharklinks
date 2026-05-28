"""
Vendor Repository — all DB queries for vendors.
Services call these functions. No raw queries in route files.
"""
from typing import List, Optional
import uuid
from sqlalchemy import String, cast
from sqlalchemy.orm import Session
from app.models.order import Vendor


def _id_variants(value: str) -> list[str]:
    values = [value]
    try:
        parsed = uuid.UUID(str(value))
        values.extend([str(parsed), parsed.hex])
    except (TypeError, ValueError):
        pass
    return list(dict.fromkeys(values))


class VendorRepository:

    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 100, search: str = "", assigned_manager_id: Optional[str] = None) -> List[Vendor]:
        q = db.query(Vendor).filter(Vendor.is_active == True)
        if search:
            q = q.filter(Vendor.name.ilike(f"%{search}%"))
        if assigned_manager_id:
            q = q.filter(cast(Vendor.assigned_manager_id, String).in_(_id_variants(assigned_manager_id)))
        return q.offset(skip).limit(limit).all()

    @staticmethod
    def get_by_id(db: Session, vendor_id: str) -> Optional[Vendor]:
        return db.query(Vendor).filter(
            cast(Vendor.id, String).in_(_id_variants(vendor_id)),
            Vendor.is_active == True,
        ).first()

    @staticmethod
    def get_by_name(db: Session, name: str) -> Optional[Vendor]:
        return db.query(Vendor).filter(Vendor.name == name).first()

    @staticmethod
    def create(db: Session, data: dict) -> Vendor:
        vendor = Vendor(**data)
        db.add(vendor)
        db.commit()
        db.refresh(vendor)
        return vendor

    @staticmethod
    def update(db: Session, vendor: Vendor, data: dict) -> Vendor:
        for key, value in data.items():
            if value is not None:
                setattr(vendor, key, value)
        db.commit()
        db.refresh(vendor)
        return vendor

    @staticmethod
    def soft_delete(db: Session, vendor: Vendor) -> Vendor:
        vendor.is_active = False
        db.commit()
        return vendor
