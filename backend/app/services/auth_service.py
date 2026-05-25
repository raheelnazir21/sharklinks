"""
Authentication service — all auth business logic lives here.
Keeps the API route files thin and readable.
"""
import json
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token
)
from app.core.config import settings
from app.models.user import User, RefreshToken


class AuthService:

    @staticmethod
    def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
        """
        Check if the email and password are correct.
        Returns the User object if valid, None if not.
        """
        user = db.query(User).filter(User.email == email, User.is_active == True).first()
        if not user or not verify_password(password, user.password_hash):
            return None
        return user

    @staticmethod
    def create_tokens(user: User) -> dict:
        """
        Generate both access and refresh tokens for a logged-in user.
        Payload includes user ID and role for RBAC checks.
        """
        payload = {"sub": str(user.id), "role": user.role.name}
        return {
            "access_token": create_access_token(payload),
            "refresh_token": create_refresh_token(payload),
        }

    @staticmethod
    def save_refresh_token(db: Session, user_id, token: str):
        """Store the hashed refresh token in the database."""
        from app.core.security import hash_password as hash_token
        expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        db_token = RefreshToken(
            user_id=user_id,
            token_hash=hash_token(token),
            expires_at=expires_at,
        )
        db.add(db_token)
        db.commit()

    @staticmethod
    def invalidate_refresh_token(db: Session, token: str):
        """Delete the refresh token from DB on logout."""
        payload = decode_token(token)
        if payload:
            user_id = payload.get("sub")
            db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete()
            db.commit()

    @staticmethod
    def refresh_access_token(db: Session, refresh_token: str) -> Optional[str]:
        """
        Verify the refresh token and issue a new access token.
        Returns None if the token is invalid or expired.
        """
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            return None
        user_id = payload.get("sub")
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        if not user:
            return None
        new_payload = {"sub": str(user.id), "role": user.role.name}
        return create_access_token(new_payload)
