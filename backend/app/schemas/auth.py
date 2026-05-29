"""
Auth specific schemas.
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    password: str

class ChangePasswordRequest(BaseModel):
    """For logged-in users who know their current password."""
    current_password: str
    new_password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict

class UserOut(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    role: str
    is_active: bool

class PasswordResetRequestOut(BaseModel):
    """Admin view of a pending reset request."""
    id: str
    user_id: str
    user_full_name: str
    user_email: str
    status: str
    requested_at: datetime
    resolved_at: Optional[datetime] = None

