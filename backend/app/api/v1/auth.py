"""
Auth API routes — handles login, signup, password reset, logout, token refresh,
and current user.
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import create_password_reset_token, decode_token, hash_password, verify_password
from app.models.user import User, Role, RoleEnum, RefreshToken
from app.models.password_reset_request import PasswordResetRequest, ResetRequestStatus
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
    UserOut,
)
from app.services.auth_service import AuthService, normalize_email
from app.services.activity_log_service import ActivityLogService
from app.utils.response import success_response, error_response

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _serialize_user(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.name.value,
        "is_active": user.is_active,
    }


@router.post("/login", response_model=dict, summary="User Login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Accepts email + password.
    Returns access token (15 min) + refresh token (7 days).
    """
    email = normalize_email(payload.email)
    user = AuthService.authenticate_user(db, email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    tokens = AuthService.create_tokens(user)
    AuthService.save_refresh_token(db, user.id, tokens["refresh_token"])
    ActivityLogService.record(
        db,
        action="USER_LOGIN",
        entity_type="User",
        entity_id=str(user.id),
        user=user,
        payload={"details": f"User '{user.full_name}' logged in."},
        ip_address=request.client.host if request.client else None,
    )
    return success_response(
        data={
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "token_type": "bearer",
            "user": _serialize_user(user),
        },
        message="Login successful.",
    )


@router.post("/signup", response_model=dict, summary="Create User Account")
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    """
    Public signup for the user panel. New accounts start as active viewers;
    admins can promote them later from User Management.
    """
    email = normalize_email(payload.email)
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    role = db.query(Role).filter(Role.name == RoleEnum.viewer).first()
    if not role:
        role = Role(name=RoleEnum.viewer, description="Read-only access")
        db.add(role)
        db.commit()
        db.refresh(role)

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role_id=role.id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    ActivityLogService.record(
        db,
        action="USER_SIGNUP",
        entity_type="User",
        entity_id=str(user.id),
        user=user,
        payload={"details": f"Account created for '{user.full_name}'."},
    )
    return success_response(data=_serialize_user(user), message="Account created successfully.")


@router.post("/forgot-password", response_model=dict, summary="Request Password Reset")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Submits a password reset request to the admin queue.
    The request must be approved by an admin before a reset token is issued.
    Always returns success to prevent email enumeration.
    """
    user = db.query(User).filter(
        User.email == normalize_email(payload.email),
        User.is_active == True,
    ).first()

    if user:
        # Check if there's already a pending request for this user
        existing = db.query(PasswordResetRequest).filter(
            PasswordResetRequest.user_id == user.id,
            PasswordResetRequest.status == ResetRequestStatus.pending,
        ).first()

        if not existing:
            reset_request = PasswordResetRequest(
                user_id=user.id,
                status=ResetRequestStatus.pending,
            )
            db.add(reset_request)
            db.commit()
            ActivityLogService.record(
                db,
                action="PASSWORD_RESET_REQUESTED",
                entity_type="User",
                entity_id=str(user.id),
                user=user,
                payload={"details": f"Password reset requested by '{user.full_name}'."},
            )

    return success_response(
        message="If that email is registered, your reset request has been submitted. Please contact your administrator to approve it.",
    )


@router.post("/change-password", response_model=dict, summary="Self-Service Password Change")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Allows a logged-in user to change their own password.
    Requires the current (old) password to be provided and verified.
    Invalidates all existing refresh tokens to force re-login on other devices.
    """
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    current_user.password_hash = hash_password(payload.new_password)
    # Invalidate all refresh tokens — forces re-login on all devices
    db.query(RefreshToken).filter(RefreshToken.user_id == current_user.id).delete()
    db.commit()

    ActivityLogService.record(
        db,
        action="PASSWORD_CHANGED",
        entity_type="User",
        entity_id=str(current_user.id),
        user=current_user,
        payload={"details": f"Password self-changed by '{current_user.full_name}'."},
    )
    return success_response(message="Password updated successfully. Please sign in again with your new password.")


@router.post("/reset-password", response_model=dict, summary="Reset Password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    token_data = decode_token(payload.token)
    if not token_data or token_data.get("type") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    user = db.query(User).filter(User.id == token_data.get("sub"), User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.password_hash = hash_password(payload.password)
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
    db.commit()
    ActivityLogService.record(
        db,
        action="PASSWORD_RESET",
        entity_type="User",
        entity_id=str(user.id),
        user=user,
        payload={"details": f"Password reset for '{user.full_name}'."},
    )
    return success_response(message="Password reset successfully. Please sign in again.")


@router.post("/refresh", response_model=dict, summary="Refresh Access Token")
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    """
    Uses the refresh token to issue a new access token.
    Called automatically by the frontend before the access token expires.
    """
    new_access_token = AuthService.refresh_access_token(db, payload.refresh_token)
    if not new_access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token. Please log in again.",
        )
    return success_response(
        data={"access_token": new_access_token, "token_type": "bearer"},
        message="Token refreshed.",
    )


@router.post("/logout", response_model=dict, summary="User Logout")
def logout(
    payload: RefreshRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Invalidates the refresh token so the user is fully logged out.
    The access token will expire naturally after 15 minutes.
    """
    AuthService.invalidate_refresh_token(db, payload.refresh_token)
    ActivityLogService.record(
        db,
        action="USER_LOGOUT",
        entity_type="User",
        entity_id=str(current_user.id),
        user=current_user,
        payload={"details": f"User '{current_user.full_name}' logged out."},
        ip_address=request.client.host if request.client else None,
    )
    return success_response(message="Logged out successfully.")


@router.get("/me", response_model=dict, summary="Get Current User")
def get_me(current_user: User = Depends(get_current_user)):
    """Returns the profile of the currently logged-in user."""
    return success_response(data=_serialize_user(current_user))
