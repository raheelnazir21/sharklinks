from fastapi import HTTPException
from sqlalchemy import String, cast
from sqlalchemy.orm import Session

from app.models.order import Vendor
from app.models.user import RoleEnum, User
from app.repositories.order_repo import _id_variants


ADMIN_ROLES = {RoleEnum.super_admin.value, RoleEnum.admin.value}
COMPANY_WIDE_READ_ROLES = {RoleEnum.super_admin.value, RoleEnum.admin.value, RoleEnum.viewer.value}


def is_admin_user(user: User) -> bool:
    return bool(user.role and user.role.name.value in ADMIN_ROLES)


def can_view_all_company_data(user: User) -> bool:
    return bool(user.role and user.role.name.value in COMPANY_WIDE_READ_ROLES)


def vendor_access_filter(user: User):
    if can_view_all_company_data(user):
        return None
    return cast(Vendor.assigned_manager_id, String).in_(_id_variants(str(user.id)))


def scoped_vendor_query(db: Session, user: User):
    query = db.query(Vendor).filter(Vendor.is_active == True)
    access_filter = vendor_access_filter(user)
    if access_filter is not None:
        query = query.filter(access_filter)
    return query


def assert_vendor_access(db: Session, vendor_id: str, user: User) -> Vendor:
    vendor = db.query(Vendor).filter(
        cast(Vendor.id, String).in_(_id_variants(vendor_id)),
        Vendor.is_active == True,
    ).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    if can_view_all_company_data(user):
        return vendor
    if str(vendor.assigned_manager_id) == str(user.id):
        return vendor
    raise HTTPException(status_code=403, detail="You can only access your assigned vendors.")

