"""
PO & Style Service for Sharknits (v2.0).
Provides:
- Atomic, persistent PO sequence generation (SK100, SK101, ... never reuse)
- Style code generation: BRAND_INITIALS_ARTICLE_INITIALS (e.g., DZ_BJ)
- Style reuse across orders
- Collision handling for different designs sharing initials (appends -2, -3)
"""
import re
from typing import Optional
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.models.order import POSequence, Style, Order


def generate_next_po_number(db: Session, prefix: str = "SK") -> str:
    """
    Allocates a unique, sequential PO number starting at SK100.
    Atomic, never reuses numbers, and persists across restarts and order deletions.
    """
    dialect = db.bind.dialect.name if db.bind else "sqlite"
    
    # Lock-safe query if on PostgreSQL
    if dialect == "postgresql":
        seq = db.query(POSequence).filter(POSequence.prefix == prefix).with_for_update().first()
    else:
        seq = db.query(POSequence).filter(POSequence.prefix == prefix).first()

    if not seq:
        # Check highest existing number in orders table to never duplicate historical data
        highest = 99  # So sequence starts at 100
        existing = db.query(Order.po_number).filter(Order.po_number.isnot(None)).all()
        for (val,) in existing:
            if val and val.startswith(prefix):
                try:
                    num_part = int(val[len(prefix):])
                    if num_part > highest:
                        highest = num_part
                except (ValueError, TypeError):
                    pass

        seq = POSequence(prefix=prefix, next_val=highest + 1)
        db.add(seq)
        db.flush()

    assigned_num = seq.next_val
    seq.next_val = assigned_num + 1
    db.commit()
    return f"{prefix}{assigned_num}"


def extract_initials(text_val: Optional[str], default: str = "XX") -> str:
    """Extracts uppercase initials from words (e.g. 'Delta Zeta' -> 'DZ', 'Baseball Jersey' -> 'BJ')."""
    if not text_val:
        return default
    cleaned = re.sub(r'[^a-zA-Z0-9\s]', ' ', text_val.strip())
    words = [w for w in cleaned.split() if w]
    if not words:
        return default
    if len(words) == 1:
        single = words[0].upper()
        return single[:2] if len(single) >= 2 else f"{single}X"
    return "".join(w[0].upper() for w in words)


def resolve_or_create_style(
    db: Session,
    brand_name: Optional[str] = None,
    article_type: Optional[str] = None,
    style_code: Optional[str] = None,
    description: Optional[str] = None,
) -> str:
    """
    Resolves an existing style or registers a new style record.
    If style_code is given explicitly, verifies/creates it.
    If brand + article are given, generates BRAND_ARTICLE (e.g. DZ_BJ).
    Collision rule: If the code exists for a DIFFERENT brand/article, auto-suffixes with -2, -3.
    """
    brand_clean = (brand_name or "").strip()
    article_clean = (article_type or "").strip()

    if style_code and style_code.strip():
        code = style_code.strip().upper()
        existing = db.query(Style).filter(Style.style_code == code).first()
        if not existing:
            st = Style(
                style_code=code,
                brand_name=brand_clean or None,
                article_type=article_clean or None,
                description=description,
            )
            db.add(st)
            db.commit()
        return code

    b_init = extract_initials(brand_clean, default="SK")
    a_init = extract_initials(article_clean, default="AR")
    base_code = f"{b_init}_{a_init}"

    # Check for existing style
    existing = db.query(Style).filter(Style.style_code == base_code).first()
    if not existing:
        st = Style(
            style_code=base_code,
            brand_name=brand_clean or None,
            article_type=article_clean or None,
            description=description,
        )
        db.add(st)
        db.commit()
        return base_code

    # If existing has same brand and article, reuse it
    if (
        (existing.brand_name or "").strip().lower() == brand_clean.lower()
        and (existing.article_type or "").strip().lower() == article_clean.lower()
    ):
        return existing.style_code

    # Collision with a different design: find next available suffix -2, -3...
    counter = 2
    while True:
        candidate = f"{base_code}-{counter}"
        cand_existing = db.query(Style).filter(Style.style_code == candidate).first()
        if not cand_existing:
            st = Style(
                style_code=candidate,
                brand_name=brand_clean or None,
                article_type=article_clean or None,
                description=description,
            )
            db.add(st)
            db.commit()
            return candidate
        if (
            (cand_existing.brand_name or "").strip().lower() == brand_clean.lower()
            and (cand_existing.article_type or "").strip().lower() == article_clean.lower()
        ):
            return cand_existing.style_code
        counter += 1

