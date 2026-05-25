"""
Article Codes & Product Colors API (Track 3).
Manages article master data and their color variants.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles, get_current_user
from app.models.user import RoleEnum
from app.models.qc_report import ArticleCode, ProductColor
from app.schemas.qc_report import ArticleCodeCreate, ArticleCodeUpdate, ProductColorCreate
from app.utils.response import success_response

router = APIRouter(prefix="/articles", tags=["Articles & Colors"])

QCAccess      = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager, RoleEnum.qc_officer])
ManagerAccess = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager])


# ─── Article Codes ────────────────────────────────────────────────────────────

@router.get("", summary="List all article codes")
def list_articles(
    track_type: Optional[str] = Query(None),
    is_active: bool = Query(True),
    db: Session = Depends(get_db),
    _=Depends(QCAccess),
):
    q = db.query(ArticleCode).filter(ArticleCode.is_active == is_active)
    if track_type:
        q = q.filter(ArticleCode.track_type.in_([track_type, "both"]))
    articles = q.order_by(ArticleCode.code).all()
    return success_response(data=[
        {
            "id":           str(a.id),
            "code":         a.code,
            "name":         a.name,
            "product_name": a.product_name,
            "track_type":   a.track_type,
            "is_active":    a.is_active,
            "colors": [
                {
                    "id":         str(c.id),
                    "color_name": c.color_name,
                    "color_hex":  c.color_hex,
                    "is_active":  c.is_active,
                }
                for c in a.colors if c.is_active
            ],
        }
        for a in articles
    ])


@router.post("", summary="Create an article code")
def create_article(
    payload: ArticleCodeCreate,
    db: Session = Depends(get_db),
    _=Depends(ManagerAccess),
):
    # Check uniqueness
    existing = db.query(ArticleCode).filter(ArticleCode.code == payload.code).first()
    if existing:
        raise HTTPException(409, f"Article code '{payload.code}' already exists.")

    article = ArticleCode(
        code=payload.code,
        name=payload.name,
        product_name=payload.product_name,
        track_type=payload.track_type,
    )
    db.add(article)
    db.flush()

    for color_data in payload.colors:
        color = ProductColor(
            article_id=str(article.id),
            color_name=color_data.color_name,
            color_hex=color_data.color_hex,
        )
        db.add(color)

    db.commit()
    db.refresh(article)
    return success_response(data={"id": str(article.id), "code": article.code}, message="Article created.")


@router.get("/{article_id}", summary="Get article detail with colors")
def get_article(article_id: str, db: Session = Depends(get_db), _=Depends(QCAccess)):
    article = db.query(ArticleCode).filter(ArticleCode.id == article_id).first()
    if not article:
        raise HTTPException(404, "Article not found.")
    return success_response(data={
        "id":           str(article.id),
        "code":         article.code,
        "name":         article.name,
        "product_name": article.product_name,
        "track_type":   article.track_type,
        "is_active":    article.is_active,
        "colors": [
            {"id": str(c.id), "color_name": c.color_name, "color_hex": c.color_hex, "is_active": c.is_active}
            for c in article.colors
        ],
    })


@router.put("/{article_id}", summary="Update article code")
def update_article(
    article_id: str,
    payload: ArticleCodeUpdate,
    db: Session = Depends(get_db),
    _=Depends(ManagerAccess),
):
    article = db.query(ArticleCode).filter(ArticleCode.id == article_id).first()
    if not article:
        raise HTTPException(404, "Article not found.")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(article, k, v)
    db.commit()
    return success_response(message="Article updated.")


@router.delete("/{article_id}", summary="Soft-delete article code")
def delete_article(article_id: str, db: Session = Depends(get_db), _=Depends(ManagerAccess)):
    article = db.query(ArticleCode).filter(ArticleCode.id == article_id).first()
    if not article:
        raise HTTPException(404, "Article not found.")
    article.is_active = False
    db.commit()
    return success_response(message="Article deactivated.")


# ─── Product Colors ───────────────────────────────────────────────────────────

@router.post("/{article_id}/colors", summary="Add a color to an article")
def add_color(
    article_id: str,
    payload: ProductColorCreate,
    db: Session = Depends(get_db),
    _=Depends(ManagerAccess),
):
    article = db.query(ArticleCode).filter(ArticleCode.id == article_id).first()
    if not article:
        raise HTTPException(404, "Article not found.")
    color = ProductColor(
        article_id=article_id,
        color_name=payload.color_name,
        color_hex=payload.color_hex,
    )
    db.add(color)
    db.commit()
    db.refresh(color)
    return success_response(data={"id": str(color.id), "color_name": color.color_name}, message="Color added.")


@router.delete("/{article_id}/colors/{color_id}", summary="Remove a color variant")
def delete_color(
    article_id: str,
    color_id: str,
    db: Session = Depends(get_db),
    _=Depends(ManagerAccess),
):
    color = db.query(ProductColor).filter(
        ProductColor.id == color_id,
        ProductColor.article_id == article_id,
    ).first()
    if not color:
        raise HTTPException(404, "Color not found.")
    color.is_active = False
    db.commit()
    return success_response(message="Color removed.")
