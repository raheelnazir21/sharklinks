"""Activity log helpers for factory historian events."""
import json
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User


class ActivityLogService:
    @staticmethod
    def record(
        db: Session,
        *,
        action: str,
        entity_type: str,
        entity_id: str,
        user: Optional[User] = None,
        payload: Optional[dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        commit: bool = True,
    ) -> AuditLog:
        log = AuditLog(
            user_id=user.id if user else None,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            payload=json.dumps(payload or {}, default=str),
            ip_address=ip_address,
        )
        db.add(log)
        if commit:
            db.commit()
            db.refresh(log)
        return log

