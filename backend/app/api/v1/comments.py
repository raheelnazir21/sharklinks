"""
Stage Comments API.
Threaded comment system per production stage — replaces single remarks textarea.
Newest comments first. Full history preserved.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.order import ProductionStage, Order
from app.models.comments_notifications import StageComment
from app.utils.response import success_response

router = APIRouter(prefix="/comments", tags=["Comments"])

AllStaff = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager, RoleEnum.qc_officer])


class CommentCreate(BaseModel):
    text: str


@router.get("/stage/{stage_id}", summary="List comments for a stage (newest first)")
def list_stage_comments(
    stage_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stage = db.query(ProductionStage).filter(ProductionStage.id == stage_id).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found.")

    comments = (
        db.query(StageComment)
        .filter(StageComment.stage_id == stage_id)
        .order_by(StageComment.created_at.desc())
        .all()
    )

    return success_response(data=[
        {
            "id": str(c.id),
            "text": c.text,
            "created_at": c.created_at.isoformat(),
            "author_id": str(c.created_by) if c.created_by else None,
            "author_name": c.author.full_name if c.author else "System",
            "author_initials": (c.author.full_name or "S")[:2].upper() if c.author else "SY",
        }
        for c in comments
    ])


@router.post("/stage/{stage_id}", summary="Post a new comment on a stage")
def post_stage_comment(
    stage_id: str,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(AllStaff),
):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Comment text cannot be empty.")

    stage = db.query(ProductionStage).filter(ProductionStage.id == stage_id).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found.")

    comment = StageComment(
        stage_id=stage_id,
        order_id=stage.order_id,
        text=payload.text.strip(),
        created_by=current_user.id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return success_response(data={
        "id": str(comment.id),
        "text": comment.text,
        "created_at": comment.created_at.isoformat(),
        "author_id": str(comment.created_by),
        "author_name": current_user.full_name,
        "author_initials": (current_user.full_name or "U")[:2].upper(),
    }, message="Comment posted.")


@router.delete("/{comment_id}", summary="Delete a comment (own comments or admin)")
def delete_comment(
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(AllStaff),
):
    comment = db.query(StageComment).filter(StageComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found.")

    is_admin = current_user.role.name in ["super_admin", "admin"]
    is_own = str(comment.created_by) == str(current_user.id)

    if not is_admin and not is_own:
        raise HTTPException(status_code=403, detail="You can only delete your own comments.")

    db.delete(comment)
    db.commit()
    return success_response(message="Comment deleted.")
