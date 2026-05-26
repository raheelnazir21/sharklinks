"""
Users API routes — admin can manage all users (create, list, update, deactivate).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.security import hash_password
from app.models.user import User, Role, RoleEnum
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.services.activity_log_service import ActivityLogService
from app.utils.response import success_response

router = APIRouter(prefix="/users", tags=["Users"])

# Only admin and super_admin can manage users
AdminOnly = require_roles([RoleEnum.super_admin, RoleEnum.admin])


def _serialize_user(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.name.value,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.get("", response_model=dict, summary="List All Users")
@router.get("/", response_model=dict, summary="List All Users", include_in_schema=False)
def list_users(
    db: Session = Depends(get_db),
    _=Depends(AdminOnly),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return success_response(data=[_serialize_user(u) for u in users])


@router.post("", response_model=dict, summary="Create New User")
@router.post("/", response_model=dict, summary="Create New User", include_in_schema=False)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(AdminOnly),
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    role = db.query(Role).filter(Role.name == payload.role).first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role '{payload.role}' not found.")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role_id=role.id,
        is_active=payload.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    ActivityLogService.record(
        db,
        action="USER_CREATED",
        entity_type="User",
        entity_id=str(user.id),
        user=current_user,
        payload={"details": f"System login created for '{user.full_name}'."},
    )
    return success_response(
        data=_serialize_user(user),
        message="User created successfully.",
    )


@router.put("/{user_id}", response_model=dict, summary="Update User")
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(AdminOnly),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if payload.email is not None and payload.email != user.email:
        existing = db.query(User).filter(User.email == payload.email, User.id != user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered.")
        user.email = payload.email
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.password:
        user.password_hash = hash_password(payload.password)
    if payload.is_active is not None:
        if str(user.id) == str(current_user.id) and payload.is_active is False:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")
        user.is_active = payload.is_active
    if payload.role is not None:
        role = db.query(Role).filter(Role.name == payload.role).first()
        if not role:
            raise HTTPException(status_code=400, detail="Role not found.")
        user.role_id = role.id

    db.commit()
    db.refresh(user)
    ActivityLogService.record(
        db,
        action="USER_UPDATED",
        entity_type="User",
        entity_id=str(user.id),
        user=current_user,
        payload={"details": f"Updated profile/access for '{user.full_name}'."},
    )
    return success_response(data=_serialize_user(user), message="User updated successfully.")


@router.delete("/{user_id}", response_model=dict, summary="Deactivate User (Soft Delete)")
def deactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(AdminOnly),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if str(user.id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")
    user.is_active = False  # Soft delete — never hard delete users
    db.commit()
    ActivityLogService.record(
        db,
        action="USER_DEACTIVATED",
        entity_type="User",
        entity_id=str(user.id),
        user=current_user,
        payload={"details": f"Deactivated user '{user.full_name}'."},
    )
    return success_response(message="User deactivated successfully.")
