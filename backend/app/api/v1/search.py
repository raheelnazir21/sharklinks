"""
Global Search API — cross-entity search for Orders, Vendors, Sample & Bulk Projects.
Returns up to 5 results per category with type labels and navigation hrefs.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, String, cast
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.order import Order, Vendor, SampleClass, BulkClass
from app.utils.response import success_response

router = APIRouter(prefix="/search", tags=["Search"])

LIMIT = 5


@router.get("", response_model=dict, summary="Global Search")
@router.get("/", response_model=dict, summary="Global Search")
def global_search(
    q: str = Query("", min_length=1, description="Search query"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Search across Orders, Vendors, Sample Projects and Bulk Projects.
    Returns up to 5 hits per category.
    """
    if not q or len(q.strip()) < 1:
        return success_response(data=[])

    term = f"%{q.strip()}%"
    results = []

    # ── Orders ────────────────────────────────────────────────────────────────
    orders = (
        db.query(Order)
        .filter(
            Order.is_active == True,
            or_(
                Order.order_no.ilike(term),
                Order.product_name.ilike(term),
                Order.style_name.ilike(term),
                Order.tech_pack_no.ilike(term),
                Order.fabric.ilike(term),
            ),
        )
        .limit(LIMIT)
        .all()
    )
    for o in orders:
        results.append({
            "type": "order",
            "label": o.product_name or o.style_name or o.order_no or "Untitled Order",
            "sublabel": f"Order #{o.order_no or '—'} · {o.status}",
            "href": f"/orders/{o.id}",
            "badge": o.track_type or "bulk",
        })

    # ── Vendors ───────────────────────────────────────────────────────────────
    vendors = (
        db.query(Vendor)
        .filter(
            Vendor.is_active == True,
            or_(
                Vendor.name.ilike(term),
                Vendor.contact_person.ilike(term),
                Vendor.email.ilike(term),
                Vendor.country.ilike(term),
            ),
        )
        .limit(LIMIT)
        .all()
    )
    for v in vendors:
        results.append({
            "type": "vendor",
            "label": v.name,
            "sublabel": f"{v.contact_person or ''}{' · ' + v.country if v.country else ''}".strip(" ·"),
            "href": f"/vendors",
            "badge": "vendor",
        })

    # ── Sample Projects ───────────────────────────────────────────────────────
    samples = (
        db.query(SampleClass)
        .filter(
            SampleClass.status != "inactive",
            or_(
                SampleClass.name.ilike(term),
                SampleClass.serial_number.ilike(term),
                SampleClass.customer.ilike(term),
            ),
        )
        .limit(LIMIT)
        .all()
    )
    for s in samples:
        results.append({
            "type": "sample",
            "label": s.name,
            "sublabel": f"Sample · {s.customer or 'No customer'}",
            "href": f"/samples",
            "badge": "sample",
        })

    # ── Bulk Projects ─────────────────────────────────────────────────────────
    bulks = (
        db.query(BulkClass)
        .filter(
            BulkClass.status != "inactive",
            or_(
                BulkClass.name.ilike(term),
                BulkClass.serial_number.ilike(term),
                BulkClass.customer.ilike(term),
            ),
        )
        .limit(LIMIT)
        .all()
    )
    for b in bulks:
        results.append({
            "type": "bulk",
            "label": b.name,
            "sublabel": f"Bulk · {b.customer or 'No customer'}",
            "href": f"/bulk-projects",
            "badge": "bulk",
        })

    return success_response(data=results)
