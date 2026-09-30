"""
Users API routes — admin can manage all users (create, list, update, deactivate).
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.security import hash_password, create_password_reset_token
from app.models.user import User, Role, RoleEnum
from app.models.password_reset_request import PasswordResetRequest, ResetRequestStatus
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.services.auth_service import normalize_email
from app.services.activity_log_service import ActivityLogService
from app.utils.response import success_response

router = APIRouter(prefix="/users", tags=["Users"])

# Only admin and super_admin can manage users
AdminOnly = require_roles([RoleEnum.super_admin, RoleEnum.admin])


def _serialize_user(user: User) -> dict:
    role_val = ""
    if user.role:
        role_val = user.role.name.value if hasattr(user.role.name, "value") else str(user.role.name)
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": role_val,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.get("", response_model=dict, summary="List All Users")
@router.get("/", response_model=dict, summary="List All Users", include_in_schema=False)
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    email = normalize_email(payload.email)
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    role = db.query(Role).filter(Role.name == payload.role).first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role '{payload.role}' not found.")

    user = User(
        email=email,
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

    if payload.email is not None and normalize_email(payload.email) != user.email:
        email = normalize_email(payload.email)
        existing = db.query(User).filter(User.email == email, User.id != user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered.")
        user.email = email
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


# ─── Password Reset Request Admin Endpoints ────────────────────────────────


@router.get("/reset-requests", response_model=dict, summary="List Password Reset Requests")
def list_reset_requests(
    db: Session = Depends(get_db),
    _: User = Depends(AdminOnly),
):
    """
    Returns all pending password reset requests.
    Admin uses this to decide who to approve or reject.
    """
    requests = (
        db.query(PasswordResetRequest)
        .filter(PasswordResetRequest.status == ResetRequestStatus.pending)
        .order_by(PasswordResetRequest.requested_at.asc())
        .all()
    )
    data = [
        {
            "id": str(r.id),
            "user_id": str(r.user_id),
            "user_full_name": r.user.full_name if r.user else "Unknown",
            "user_email": r.user.email if r.user else "Unknown",
            "status": r.status.value,
            "requested_at": r.requested_at.isoformat(),
        }
        for r in requests
    ]
    return success_response(data=data)


@router.post("/reset-requests/{request_id}/approve", response_model=dict, summary="Approve Password Reset Request")
def approve_reset_request(
    request_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(AdminOnly),
):
    """
    Admin approves a reset request.
    Generates a one-time reset token valid for 30 minutes.
    Returns the reset URL so the admin can share it with the user.
    """
    from datetime import datetime
    reset_req = db.query(PasswordResetRequest).filter(
        PasswordResetRequest.id == request_id,
        PasswordResetRequest.status == ResetRequestStatus.pending,
    ).first()
    if not reset_req:
        raise HTTPException(status_code=404, detail="Reset request not found or already resolved.")

    token = create_password_reset_token(
        {"sub": str(reset_req.user_id)},
        expires_delta=timedelta(minutes=30),
    )
    origin = request.headers.get("origin") or str(request.base_url).rstrip("/")
    reset_url = f"{origin}/reset-password?token={token}"

    reset_req.status = ResetRequestStatus.approved
    reset_req.resolved_at = datetime.utcnow()
    reset_req.resolved_by = current_user.id
    reset_req.reset_token = token
    reset_req.reset_token_expires_at = datetime.utcnow() + timedelta(minutes=30)
    db.commit()

    ActivityLogService.record(
        db,
        action="PASSWORD_RESET_APPROVED",
        entity_type="User",
        entity_id=str(reset_req.user_id),
        user=current_user,
        payload={"details": f"Reset request approved by '{current_user.full_name}' for user '{reset_req.user.full_name}'."},
    )
    return success_response(
        data={"reset_url": reset_url, "expires_in_minutes": 30},
        message="Reset request approved. Share the link below with the user.",
    )


@router.post("/reset-requests/{request_id}/reject", response_model=dict, summary="Reject Password Reset Request")
def reject_reset_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(AdminOnly),
):
    """
    Admin rejects a reset request. The user will need to re-submit if needed.
    """
    from datetime import datetime
    reset_req = db.query(PasswordResetRequest).filter(
        PasswordResetRequest.id == request_id,
        PasswordResetRequest.status == ResetRequestStatus.pending,
    ).first()
    if not reset_req:
        raise HTTPException(status_code=404, detail="Reset request not found or already resolved.")

    reset_req.status = ResetRequestStatus.rejected
    reset_req.resolved_at = datetime.utcnow()
    reset_req.resolved_by = current_user.id
    db.commit()

    ActivityLogService.record(
        db,
        action="PASSWORD_RESET_REJECTED",
        entity_type="User",
        entity_id=str(reset_req.user_id),
        user=current_user,
        payload={"details": f"Reset request rejected by '{current_user.full_name}' for user '{reset_req.user.full_name}'."},
    )
    return success_response(message="Reset request rejected.")
