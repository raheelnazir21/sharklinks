"""
User and Auth Schemas for validation and serialization.
"""
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from app.models.user import RoleEnum
from datetime import datetime

# ─── Auth Schemas ──────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# ─── User Schemas ──────────────────────────────────────────────────────────

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: RoleEnum = RoleEnum.viewer
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[RoleEnum] = None
    is_active: Optional[bool] = None

class UserOut(UserBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True
