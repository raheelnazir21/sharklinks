"""Activity Logs API — searchable audit history for the factory historian."""
import csv
import io
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.core.access_control import is_admin_user, can_view_all_company_data
from app.models.audit_log import AuditLog
from app.models.user import RoleEnum, User
from app.utils.response import success_response

router = APIRouter(prefix="/activity-logs", tags=["Activity Logs"])

ActivityLogAccess = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager, RoleEnum.viewer])


def _payload(log: AuditLog) -> dict:
    if not log.payload:
        return {}
    try:
        parsed = json.loads(log.payload)
        return parsed if isinstance(parsed, dict) else {"value": parsed}
    except json.JSONDecodeError:
        return {"details": log.payload}


def _serialize_log(log: AuditLog) -> dict:
    payload = _payload(log)
    return {
        "id": str(log.id),
        "action": log.action,
        "entity_type": log.entity_type,
        "entity_id": log.entity_id,
        "payload": payload,
        "details": payload.get("details") or payload.get("message") or "",
        "ip_address": log.ip_address,
        "created_at": log.created_at.isoformat() if log.created_at else None,
        "user": {
            "id": str(log.user.id),
            "full_name": log.user.full_name,
            "email": log.user.email,
            "role": log.user.role.name.value if log.user.role else None,
        } if log.user else None,
    }


def _base_query(db: Session):
    return db.query(AuditLog).options(joinedload(AuditLog.user))


@router.get("", response_model=dict, summary="List Activity Logs")
@router.get("/", response_model=dict, summary="List Activity Logs", include_in_schema=False)
def list_activity_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str = Query("", description="Search action, entity, details or user"),
    action: str = Query("", description="Filter by action"),
    entity_type: str = Query("", description="Filter by entity type"),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(ActivityLogAccess),
):
    query = _base_query(db)
    if not can_view_all_company_data(current_user):
        query = query.filter(AuditLog.user_id == current_user.id)

    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if date_from:
        query = query.filter(AuditLog.created_at >= date_from)
    if date_to:
        query = query.filter(AuditLog.created_at <= date_to)
    if search:
        term = f"%{search}%"
        query = query.outerjoin(AuditLog.user).filter(
            or_(
                AuditLog.action.ilike(term),
                AuditLog.entity_type.ilike(term),
                AuditLog.entity_id.ilike(term),
                AuditLog.payload.ilike(term),
                User.full_name.ilike(term),
                User.email.ilike(term),
            )
        )

    total = query.count()
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return success_response(data={"total": total, "items": [_serialize_log(log) for log in logs]})


@router.get("/recent", response_model=dict, summary="Recent Historian Events")
def recent_activity_logs(
    limit: int = Query(6, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(ActivityLogAccess),
):
    query = _base_query(db)
    if not can_view_all_company_data(current_user):
        query = query.filter(AuditLog.user_id == current_user.id)
    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return success_response(data=[_serialize_log(log) for log in logs])


@router.get("/export.csv", summary="Export Activity Logs CSV")
def export_activity_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(ActivityLogAccess),
):
    query = _base_query(db)
    if not can_view_all_company_data(current_user):
        query = query.filter(AuditLog.user_id == current_user.id)
    logs = query.order_by(AuditLog.created_at.desc()).limit(5000).all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Time", "Action", "Entity Type", "Entity ID", "User", "Email", "Details"])
    for log in logs:
        payload = _payload(log)
        writer.writerow([
            log.created_at.isoformat() if log.created_at else "",
            log.action,
            log.entity_type,
            log.entity_id,
            log.user.full_name if log.user else "System",
            log.user.email if log.user else "",
            payload.get("details") or payload.get("message") or json.dumps(payload),
        ])
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=activity-logs.csv"},
    )
