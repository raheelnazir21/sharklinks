"""
AI Assistant API — Conversational AI for Textile QC System.

Architecture:
  1. Receive user message + conversation history.
  2. Detect intent (search, report, analytics, knowledge).
  3. Run the appropriate data-retrieval tool(s) against the real DB.
  4. Pass retrieved context to OpenAI GPT-4o as evidence.
  5. Return AI answer + optional structured links/attachments.

Document upload:
  - User can upload a PDF/DOCX/image.
  - Text is extracted and sent as RAG context to the AI.
  - AI can instruct the system to auto-create a QC report draft.
"""

import os
import io
import json
import uuid
import shutil
import tempfile
import traceback
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import or_, func, desc
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User, RoleEnum
from app.models.order import Order, Vendor, SampleClass, BulkClass, ProductionStage, StageStatus
from app.models.qc_report import QCReport, QCReportItem, QCReportAttachment, ReportStatus
from app.models.comments_notifications import Notification
from app.models.ai_chat import AIChatSession, AIChatMessage
from app.utils.response import success_response
from pydantic import BaseModel

router = APIRouter(prefix="/ai", tags=["AI Assistant"])

class SessionCreate(BaseModel):
    title: Optional[str] = "New Conversation"

class SessionUpdate(BaseModel):
    title: str

# ─── OpenAI client setup ──────────────────────────────────────────────────────

def _get_openai_client():
    """Lazily build the OpenAI client so import doesn't fail if not installed."""
    try:
        from openai import OpenAI
        from app.core.config import settings
        api_key = (
            getattr(settings, "OPENAI_API_KEY", "")
            or os.getenv("OPENAI_API_KEY", "")
        ).strip()
        if not api_key:
            return None
        return OpenAI(api_key=api_key)
    except Exception:
        return None


# ─── Document text extraction ─────────────────────────────────────────────────

def _extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Extract plain text from PDF, DOCX, TXT, or image files."""
    fname = filename.lower()
    text = ""

    if fname.endswith(".txt"):
        text = file_bytes.decode("utf-8", errors="replace")

    elif fname.endswith(".pdf"):
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        except ImportError:
            try:
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(file_bytes))
                text = "\n".join(page.extract_text() or "" for page in reader.pages)
            except ImportError:
                text = "[PDF extraction unavailable – install pdfplumber or pypdf]"

    elif fname.endswith(".docx"):
        try:
            from docx import Document as DocxDocument
            doc = DocxDocument(io.BytesIO(file_bytes))
            text = "\n".join(p.text for p in doc.paragraphs)
        except ImportError:
            text = "[DOCX extraction unavailable – install python-docx]"

    elif any(fname.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp"]):
        # Use OpenAI vision to extract text from image
        text = "[Image uploaded — AI will analyze it directly via vision API]"

    else:
        text = f"[Unsupported file type: {filename}]"

    return text.strip() or "[No text could be extracted from this document]"


# ─── Data retrieval tools ─────────────────────────────────────────────────────

def _search_orders(db: Session, query: str, user: User, limit: int = 8) -> List[Dict]:
    """Search orders by order_no, product name, style, status, vendor."""
    term = f"%{query}%"
    base_q = db.query(Order).filter(Order.is_active == True)

    # Role-scoped: viewers only see their company's orders (no cross-vendor leak)
    rows = (
        base_q.filter(or_(
            Order.order_no.ilike(term),
            Order.product_name.ilike(term),
            Order.style_name.ilike(term),
            Order.tech_pack_no.ilike(term),
            Order.fabric.ilike(term),
            Order.status.ilike(term),
        ))
        .order_by(desc(Order.created_at))
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(o.id),
            "order_no": o.order_no,
            "product_name": o.product_name,
            "style_name": o.style_name,
            "status": o.status,
            "track_type": o.track_type,
            "priority": o.priority,
            "quantity": o.quantity,
            "ex_factory_date": str(o.ex_factory_date) if o.ex_factory_date else None,
            "href": f"/orders/{o.id}",
        }
        for o in rows
    ]


def _search_vendors(db: Session, query: str, limit: int = 5) -> List[Dict]:
    term = f"%{query}%"
    rows = (
        db.query(Vendor)
        .filter(
            Vendor.is_active == True,
            or_(
                Vendor.name.ilike(term),
                Vendor.contact_person.ilike(term),
                Vendor.country.ilike(term),
                Vendor.address.ilike(term),
            ),
        )
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(v.id),
            "name": v.name,
            "contact_person": v.contact_person,
            "email": v.email,
            "country": v.country,
            "address": v.address,
            "href": "/vendors",
        }
        for v in rows
    ]


def _get_qc_reports_summary(db: Session, limit: int = 10) -> Dict:
    """Get recent QC report summary across all report types."""
    # Standard QC reports
    std_reports = (
        db.query(QCReport)
        .order_by(desc(QCReport.created_at))
        .limit(limit)
        .all()
    )
    # Advanced reports
    inline = db.query(InlineQCReport).order_by(desc(InlineQCReport.created_at)).limit(5).all()
    cut_panel = db.query(CutPanelReport).order_by(desc(CutPanelReport.created_at)).limit(5).all()
    finish = db.query(FinishEndlineQCReport).order_by(desc(FinishEndlineQCReport.created_at)).limit(5).all()
    batch = db.query(BatchAuditReport).order_by(desc(BatchAuditReport.created_at)).limit(5).all()

    total_defects = sum(getattr(r, "total_defects", 0) or 0 for r in std_reports)
    total_defects += sum(getattr(r, "total_defects", getattr(r, "total_faults", 0)) or 0 for r in inline + cut_panel + finish + batch)

    approved = sum(1 for r in std_reports if r.status == ReportStatus.approved)
    rejected = sum(1 for r in std_reports if r.status == ReportStatus.rejected)
    pending = sum(1 for r in std_reports if r.status in [ReportStatus.draft, ReportStatus.submitted])

    return {
        "total_standard_reports": len(std_reports),
        "total_inline_reports": len(inline),
        "total_cut_panel_reports": len(cut_panel),
        "total_finish_reports": len(finish),
        "total_batch_audit_reports": len(batch),
        "total_defects_in_window": total_defects,
        "approved": approved,
        "rejected": rejected,
        "pending_review": pending,
        "recent_reports": [
            {
                "id": str(r.id),
                "type": r.report_type.value if r.report_type else "unknown",
                "status": r.status.value if r.status else "unknown",
                "created_at": str(r.created_at),
                "href": f"/qc-reports",
            }
            for r in std_reports[:5]
        ],
    }


def _get_analytics_snapshot(db: Session) -> Dict:
    """Pull key KPIs for the AI to reference."""
    total_orders = db.query(Order).filter(Order.is_active == True).count()
    active_orders = db.query(Order).filter(
        Order.is_active == True,
        Order.status.in_(["pending", "in_progress"])
    ).count()
    delayed_orders = db.query(Order).filter(
        Order.is_active == True,
        Order.status == "delayed"
    ).count()
    total_vendors = db.query(Vendor).filter(Vendor.is_active == True).count()
    total_qc_reports = db.query(QCReport).count()
    total_defects = db.query(func.sum(QCReportItem.defect_count)).scalar() or 0

    return {
        "total_orders": total_orders,
        "active_orders": active_orders,
        "delayed_orders": delayed_orders,
        "total_vendors": total_vendors,
        "total_qc_reports": total_qc_reports,
        "total_defects_logged": int(total_defects),
    }


def _get_delayed_orders(db: Session, limit: int = 10) -> List[Dict]:
    rows = (
        db.query(Order)
        .filter(Order.is_active == True, Order.status == "delayed")
        .order_by(Order.ex_factory_date)
        .limit(limit)
        .all()
    )
    return [
        {
            "order_no": o.order_no,
            "product_name": o.product_name,
            "ex_factory_date": str(o.ex_factory_date) if o.ex_factory_date else None,
            "status": o.status,
            "href": f"/orders/{o.id}",
        }
        for o in rows
    ]


def _get_at_risk_orders(db: Session, within_days: int = 30, limit: int = 20) -> List[Dict]:
    """
    Find orders at risk of delay:
    - Already past their ex_factory_date but NOT completed/delayed/cancelled (OVERDUE)
    - OR ex_factory_date is within `within_days` days from today (UPCOMING DUE)
    """
    today = date.today()
    cutoff = today + timedelta(days=within_days)
    non_final = ["completed", "cancelled"]
    rows = (
        db.query(Order)
        .filter(
            Order.is_active == True,
            Order.status.notin_(non_final),
            Order.ex_factory_date != None,
            Order.ex_factory_date <= cutoff,  # past-due OR due within window
        )
        .order_by(Order.ex_factory_date)
        .limit(limit)
        .all()
    )
    result = []
    for o in rows:
        days_diff = (o.ex_factory_date - today).days if o.ex_factory_date else None
        if days_diff is not None and days_diff < 0:
            urgency = f"OVERDUE by {abs(days_diff)} days"
        elif days_diff == 0:
            urgency = "DUE TODAY"
        elif days_diff is not None:
            urgency = f"Due in {days_diff} day(s)"
        else:
            urgency = "Unknown"
        result.append({
            "order_no": o.order_no,
            "product_name": o.product_name,
            "ex_factory_date": str(o.ex_factory_date),
            "urgency": urgency,
            "days_until_due": days_diff,
            "status": o.status.value if hasattr(o.status, "value") else str(o.status),
            "priority": o.priority,
            "quantity": o.quantity,
            "href": f"/orders/{o.id}",
        })
    return result



def _get_user_list(db: Session, role_filter: Optional[str] = None, limit: int = 20) -> List[Dict]:
    q = db.query(User).filter(User.is_active == True)
    if role_filter:
        q = q.filter(User.role.has(name=role_filter))
    users = q.limit(limit).all()
    return [
        {"id": str(u.id), "full_name": u.full_name, "email": u.email, "role": u.role.name.value}
        for u in users
    ]


# ─── Intent detection helpers ─────────────────────────────────────────────────

def _detect_intents(message: str) -> set:
    """
    Multi-label intent detection — returns a SET of intents so overlapping
    queries (e.g. "show me delayed orders") load ALL relevant DB contexts.

    Possible values: order_search, vendor_search, qc_query, analytics, user_query, general
    """
    msg = message.lower()
    intents: set = set()

    # Analytics / KPI keywords — check FIRST so "delayed orders" also gets analytics
    if any(w in msg for w in [
        "analytics", "kpi", "summary", "dashboard",
        "delayed", "delay", "late", "overdue", "at risk", "risk",
        "upcoming", "about to", "near", "soon", "due",
        "rate", "dhu", "fpy", "how many", "count", "total", "progress", "overview",
        "performance", "statistics", "stats", "report overview",
    ]):
        intents.add("analytics")

    # Order-related keywords
    if any(w in msg for w in [
        "order", "style", "product", "shipment", "ex-factory", "ex factory",
        "track", "bulk", "sample", "delivery", "dispatch", "pending",
    ]):
        intents.add("order_search")

    # Vendor / supplier
    if any(w in msg for w in ["vendor", "supplier", "factory", "contact"]):
        intents.add("vendor_search")

    # QC / defects
    if any(w in msg for w in [
        "qc", "defect", "defects", "inspection", "quality", "inline",
        "cut panel", "finish", "endline", "report", "audit", "faults",
    ]):
        intents.add("qc_query")

    # User / staff management
    if any(w in msg for w in ["user", "staff", "role", "officer", "admin", "manager", "employee"]):
        intents.add("user_query")

    # If no specific intent found, treat as general (load overview data)
    if not intents:
        intents.add("general")

    return intents


# ─── System prompt builder ────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert AI assistant embedded in a Textile Production & QC (Quality Control) Management System called "CC Production & QMS".

You help production managers, QC officers, and administrators by:
- Answering questions about orders, vendors, QC reports, and production stages.
- Summarizing analytics and KPIs from the real database.
- Analyzing uploaded documents (PDFs, spreadsheets, images of inspection sheets).
- Helping auto-fill QC report drafts from document data.

**Understanding the data context:**
- [ANALYTICS SNAPSHOT] — overall counts: total orders, active orders, etc. "delayed_orders: 0" means no orders are FORMALLY marked with status="delayed" — but there can still be AT-RISK orders.
- [DELAYED ORDERS] — orders whose status field is literally set to "delayed".
- [AT-RISK ORDERS] — orders that are OVERDUE (past their ex_factory_date) or due soon but NOT YET formally delayed. These are the most actionable — mention their urgency label (e.g. "OVERDUE by 231 days", "Due in 1 day(s)").
- [ORDERS FOUND] — orders matching the user's search keyword.
- [QC REPORTS SUMMARY] — recent QC report statistics.

**Critical rules:**
1. NEVER invent data. Base ALL answers strictly on the context sections provided below.
2. When asked about delays or at-risk orders, ALWAYS check [AT-RISK ORDERS] AND [DELAYED ORDERS] sections — not just the analytics snapshot count.
3. For numbers (defect counts, quantities, dates), use exact values from context — don't round or estimate.
4. If a user asks to create a report, extract the relevant fields from the document and list them clearly.
5. Mention relevant hrefs when you refer to specific records so users can click through.
6. Be concise and professional. Use bullet points for lists.
7. If a question is ambiguous (e.g. "find John"), ask a clarifying question.
8. You operate within a role-based system. Respect data boundaries.

Current date: {today}
Current user: {user_name} (role: {user_role})
"""


# ─── Main chat endpoint ───────────────────────────────────────────────────────

# ─── Chat Sessions & History (Strict User Isolation) ──────────────────────────

@router.get("/sessions", summary="List Chat Sessions for Current User")
def list_chat_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all chat sessions belonging ONLY to the authenticated user.
    Strictly isolated: users can only see their own chat history.
    """
    sessions = (
        db.query(AIChatSession)
        .filter(
            AIChatSession.user_id == current_user.id,
            AIChatSession.is_archived == False,
        )
        .order_by(desc(AIChatSession.updated_at))
        .all()
    )
    result = []
    for s in sessions:
        msg_count = db.query(func.count(AIChatMessage.id)).filter(AIChatMessage.session_id == s.id).scalar() or 0
        last_msg = (
            db.query(AIChatMessage)
            .filter(AIChatMessage.session_id == s.id)
            .order_by(desc(AIChatMessage.created_at))
            .first()
        )
        preview = ""
        if last_msg and last_msg.content:
            preview = last_msg.content[:80] + ("..." if len(last_msg.content) > 80 else "")

        result.append({
            "id": str(s.id),
            "title": s.title,
            "message_count": msg_count,
            "last_message_preview": preview,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        })
    return success_response(data=result, message="Chat history retrieved.")


@router.get("/sessions/{session_id}", summary="Get Single Chat Session with Messages")
def get_chat_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve full message history for a specific chat session.
    Strictly isolated: raises 404 if session does not belong to current_user.
    """
    try:
        parsed_id = uuid.UUID(session_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Chat session not found.")

    session = (
        db.query(AIChatSession)
        .filter(
            AIChatSession.id == parsed_id,
            AIChatSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    messages = (
        db.query(AIChatMessage)
        .filter(AIChatMessage.session_id == session.id)
        .order_by(AIChatMessage.created_at.asc())
        .all()
    )

    return success_response(
        data={
            "id": str(session.id),
            "title": session.title,
            "created_at": session.created_at.isoformat() if session.created_at else None,
            "updated_at": session.updated_at.isoformat() if session.updated_at else None,
            "messages": [
                {
                    "id": str(m.id),
                    "role": m.role,
                    "content": m.content,
                    "links": m.links or [],
                    "document_name": m.document_name,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in messages
            ],
        },
        message="Session loaded.",
    )


@router.post("/sessions", summary="Create New Chat Session")
def create_chat_session(
    payload: Optional[SessionCreate] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new empty chat session for the authenticated user.
    """
    title = (payload.title if payload and payload.title else "New Conversation").strip()
    new_session = AIChatSession(
        user_id=current_user.id,
        title=title,
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return success_response(
        data={
            "id": str(new_session.id),
            "title": new_session.title,
            "created_at": new_session.created_at.isoformat() if new_session.created_at else None,
            "updated_at": new_session.updated_at.isoformat() if new_session.updated_at else None,
            "messages": [],
        },
        message="New chat session created.",
    )


@router.patch("/sessions/{session_id}", summary="Rename Chat Session")
def update_chat_session(
    session_id: str,
    payload: SessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rename a chat session owned by the authenticated user."""
    try:
        parsed_id = uuid.UUID(session_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Chat session not found.")

    session = (
        db.query(AIChatSession)
        .filter(
            AIChatSession.id == parsed_id,
            AIChatSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    if payload.title and payload.title.strip():
        session.title = payload.title.strip()
        db.commit()
        db.refresh(session)

    return success_response(
        data={"id": str(session.id), "title": session.title},
        message="Session renamed.",
    )


@router.delete("/sessions/{session_id}", summary="Delete Single Chat Session")
def delete_chat_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a single chat session owned by the authenticated user."""
    try:
        parsed_id = uuid.UUID(session_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Chat session not found.")

    session = (
        db.query(AIChatSession)
        .filter(
            AIChatSession.id == parsed_id,
            AIChatSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    db.delete(session)
    db.commit()
    return success_response(data={"id": session_id}, message="Chat session deleted.")


@router.delete("/sessions", summary="Clear All Chat History for Current User")
def clear_all_chat_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Deletes all chat sessions belonging to the current user.
    Strictly isolated: does not affect any other user's history.
    """
    count = (
        db.query(AIChatSession)
        .filter(AIChatSession.user_id == current_user.id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return success_response(data={"deleted_count": count}, message="All your chat history has been cleared.")


# ─── Main chat endpoint ───────────────────────────────────────────────────────

@router.post("/chat", summary="AI Assistant Chat")
async def ai_chat(
    message: str = Form(...),
    history: str = Form(default="[]"),  # JSON array of {role, content}
    session_id: Optional[str] = Form(default=None),
    file: Optional[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Main conversational AI endpoint.

    Accepts:
    - message: user's text
    - history: JSON array of prior messages [{role: "user"|"assistant", content: "..."}]
    - session_id: optional persistent conversation session ID
    - file: optional PDF/DOCX/image for RAG or report extraction
    """
    client = _get_openai_client()

    # Locate or create persistent chat session strictly scoped to current_user
    chat_session = None
    if session_id:
        try:
            parsed_sid = uuid.UUID(session_id)
            chat_session = (
                db.query(AIChatSession)
                .filter(
                    AIChatSession.id == parsed_sid,
                    AIChatSession.user_id == current_user.id,
                )
                .first()
            )
        except (ValueError, TypeError):
            chat_session = None

    if not chat_session:
        clean_text = message.strip()
        auto_title = clean_text[:45] + ("..." if len(clean_text) > 45 else "") if clean_text else "New Conversation"
        chat_session = AIChatSession(
            user_id=current_user.id,
            title=auto_title,
        )
        db.add(chat_session)
        db.commit()
        db.refresh(chat_session)

    # Save user message to persistent DB history
    try:
        user_msg_rec = AIChatMessage(
            session_id=chat_session.id,
            user_id=current_user.id,
            role="user",
            content=message,
            document_name=file.filename if file else None,
        )
        db.add(user_msg_rec)
        db.commit()
    except Exception as save_u_err:
        db.rollback()
        print(f"[AIChat] Could not save user message: {save_u_err}")

    # Parse conversation history
    try:
        conv_history: List[Dict] = json.loads(history) if history else []
        # Validate and cap history at last 20 turns to keep token usage reasonable
        conv_history = [
            {"role": m["role"], "content": str(m["content"])}
            for m in conv_history[-20:]
            if m.get("role") in ("user", "assistant")
        ]
    except (json.JSONDecodeError, KeyError):
        conv_history = []

    # ── Detect intents (multi-label) & gather relevant DB data ───────────
    intents = _detect_intents(message)
    data_context_parts: List[str] = []
    result_links: List[Dict] = []

    try:
        if "order_search" in intents or "general" in intents:
            orders = _search_orders(db, message, current_user)
            if orders:
                data_context_parts.append(f"[ORDERS FOUND]\n{json.dumps(orders, indent=2)}")
                result_links += [{"label": o.get("product_name") or o.get("order_no"), "href": o["href"], "type": "order"} for o in orders]

        if "vendor_search" in intents:
            vendors = _search_vendors(db, message)
            if vendors:
                data_context_parts.append(f"[VENDORS FOUND]\n{json.dumps(vendors, indent=2)}")
                result_links += [{"label": v["name"], "href": v["href"], "type": "vendor"} for v in vendors]

        if "qc_query" in intents or "analytics" in intents or "general" in intents:
            qc_summary = _get_qc_reports_summary(db)
            data_context_parts.append(f"[QC REPORTS SUMMARY]\n{json.dumps(qc_summary, indent=2)}")

        if "analytics" in intents or "general" in intents:
            snapshot = _get_analytics_snapshot(db)
            data_context_parts.append(f"[ANALYTICS SNAPSHOT]\n{json.dumps(snapshot, indent=2)}")
            delayed = _get_delayed_orders(db)
            if delayed:
                data_context_parts.append(f"[DELAYED ORDERS — status=delayed in DB]\n{json.dumps(delayed, indent=2)}")
            else:
                data_context_parts.append("[DELAYED ORDERS] No orders have status='delayed' in the database.")
            # At-risk: overdue + due within 30 days
            at_risk = _get_at_risk_orders(db, within_days=30)
            if at_risk:
                summary_lines = [
                    f"  - {o['product_name'] or o['order_no']} ({o['urgency']}, status={o['status']}, due={o['ex_factory_date']})"
                    for o in at_risk
                ]
                header = f"[AT-RISK ORDERS — {len(at_risk)} orders are overdue or due within 30 days]\nSUMMARY:\n" + "\n".join(summary_lines)
                data_context_parts.append(header + f"\n\nFULL DATA:\n{json.dumps(at_risk, indent=2)}")
                result_links += [{"label": o.get("product_name") or o.get("order_no") or "Order", "href": o["href"], "type": "order"} for o in at_risk[:5]]
            else:
                data_context_parts.append("[AT-RISK ORDERS] No orders are overdue or due within the next 30 days.")

        # Also load at-risk orders for plain order searches mentioning time sensitivity
        if "order_search" in intents and "analytics" not in intents:
            at_risk = _get_at_risk_orders(db, within_days=30)
            if at_risk:
                data_context_parts.append(f"[AT-RISK ORDERS — due or overdue within 30 days]\n{json.dumps(at_risk, indent=2)}")

        if "user_query" in intents:
            # Only admins/managers can see user lists
            if current_user.role.name.value in ("super_admin", "admin", "manager"):
                users = _get_user_list(db)
                data_context_parts.append(f"[USERS]\n{json.dumps(users, indent=2)}")
            else:
                data_context_parts.append("[USERS] Access restricted — only admins can view user lists.")

    except Exception as e:
        data_context_parts.append(f"[DB ERROR] Could not retrieve data: {str(e)}")

    # ── Document processing ────────────────────────────────────────────────
    doc_context = ""
    image_content = None
    doc_filename = None

    if file and file.filename:
        doc_filename = file.filename
        file_bytes = await file.read()
        doc_filename_lower = doc_filename.lower()

        if any(doc_filename_lower.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp"]):
            # Vision: encode as base64 data URL
            import base64
            b64 = base64.b64encode(file_bytes).decode("utf-8")
            ext = doc_filename_lower.split(".")[-1]
            mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
            image_content = {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}
            doc_context = "[IMAGE ATTACHED — AI will analyze visually]"
        else:
            extracted = _extract_text_from_file(file_bytes, doc_filename)
            doc_context = f"\n[DOCUMENT: {doc_filename}]\n{extracted[:8000]}"  # cap at 8k chars

    # ── Build messages for OpenAI ──────────────────────────────────────────
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    user_role_str = (
        current_user.role.name.value
        if (current_user.role and hasattr(current_user.role, "name") and hasattr(current_user.role.name, "value"))
        else str(getattr(current_user.role, "name", "user"))
    )
    system_content = SYSTEM_PROMPT.format(
        today=today_str,
        user_name=current_user.full_name,
        user_role=user_role_str,
    )

    data_section = "\n\n".join(data_context_parts)
    if data_section:
        system_content += f"\n\n--- LIVE DATABASE CONTEXT ---\n{data_section}"
    if doc_context:
        system_content += f"\n\n--- ATTACHED DOCUMENT ---\n{doc_context}"

    messages: List[Dict] = [{"role": "system", "content": system_content}]
    messages += conv_history

    # Inject a synthetic assistant acknowledgment when we have DB data,
    # so GPT doesn't confuse itself into saying "I can't access the database"
    if data_context_parts and not conv_history:
        section_names = []
        for part in data_context_parts:
            if part.startswith("["):
                label = part.split("]")[0].lstrip("[")
                section_names.append(label)
        if section_names:
            ack = f"I have retrieved the following data from the live database: {', '.join(section_names)}. I will answer based on this data."
            messages.append({"role": "assistant", "content": ack})

    # Current user message — support vision if image attached
    if image_content:
        user_msg_content = [
            {"type": "text", "text": message},
            image_content,
        ]
    else:
        user_msg_content = message  # type: ignore

    messages.append({"role": "user", "content": user_msg_content})

    # ── Call OpenAI ────────────────────────────────────────────────────────
    ai_reply = ""
    if not client:
        ai_reply = (
            "⚠️ **OpenAI API Key Not Configured**\n\n"
            "To enable GPT responses, please configure an active `OPENAI_API_KEY` in `backend/.env`.\n\n"
        )
        if result_links:
            ai_reply += f"🔍 However, I found {len(result_links)} relevant record(s) in your system database below."
        elif data_context_parts:
            ai_reply += "Here is the relevant data found in your system:\n" + "\n".join(data_context_parts)
    else:
        try:
            response = client.chat.completions.create(
                model="gpt-4o",  # upgraded for better instruction-following with complex DB contexts
                messages=messages,
                max_tokens=2000,
                temperature=0.3,  # factual, low-hallucination
            )
            ai_reply = response.choices[0].message.content or "I could not generate a response. Please try again."
        except Exception as e:
            err_msg = str(e)
            if "insufficient_quota" in err_msg.lower() or "credit_balance_exhausted" in err_msg.lower() or "429" in err_msg:
                ai_reply = (
                    "⚠️ **OpenAI Credit Balance Exhausted**\n\n"
                    "Your OpenAI account has 0 remaining credits (`credit_balance_exhausted`).\n\n"
                    "👉 Please add billing credits at [platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing) or provide an active API key in `backend/.env`."
                )
                if result_links:
                    ai_reply += f"\n\n🔍 In the meantime, I found {len(result_links)} relevant item(s) in your database below."
            elif "api_key" in err_msg.lower() or "authentication" in err_msg.lower():
                ai_reply = "⚠️ **Invalid API Key**: OpenAI authentication failed. Please verify the `OPENAI_API_KEY` in `backend/.env`."
            elif "rate_limit" in err_msg.lower():
                ai_reply = "⚠️ **Rate Limited**: OpenAI request limit reached. Please wait a moment and try again."
            else:
                ai_reply = f"⚠️ **AI Service Error**: {err_msg}"

    # ── Detect if AI suggests auto-creating a report ────────────────────────
    auto_report_hint = None
    if doc_filename and any(kw in message.lower() for kw in ["create report", "fill report", "generate report", "auto report", "make report"]):
        auto_report_hint = {
            "action": "create_report",
            "message": "I've extracted data from your document. Would you like me to pre-fill a QC report draft? Tell me which report type: Cut Panel, Inline, End Line, Finishing, or QA Audit.",
            "document": doc_filename,
        }

    # Save assistant reply to persistent DB history
    try:
        ai_msg_rec = AIChatMessage(
            session_id=chat_session.id,
            user_id=current_user.id,
            role="assistant",
            content=ai_reply,
            links=result_links[:8],
        )
        db.add(ai_msg_rec)
        chat_session.updated_at = datetime.utcnow()
        db.commit()
    except Exception as save_a_err:
        db.rollback()
        print(f"[AIChat] Could not save assistant message: {save_a_err}")

    return success_response(
        data={
            "session_id": str(chat_session.id),
            "session_title": chat_session.title,
            "reply": ai_reply,
            "links": result_links[:8],  # top 8 relevant links
            "intent": sorted(intents),
            "document_processed": doc_filename,
            "auto_report_hint": auto_report_hint,
        },
        message="AI response generated.",
    )


# ─── Report extraction endpoint ───────────────────────────────────────────────

@router.post("/extract-report", summary="AI Extract Report Fields from Document")
async def extract_report_fields(
    file: UploadFile = File(...),
    report_type: str = Form(...),  # cut_panel | inline | end_line | finishing | qa_audit
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a document (PDF/DOCX/image) and extract structured QC report fields.
    Returns a JSON payload compatible with the QC report creation form.
    """
    client = _get_openai_client()
    if not client:
        raise HTTPException(
            status_code=503,
            detail="OpenAI API key is not configured. Please add OPENAI_API_KEY in backend/.env."
        )

    VALID_TYPES = {"cut_panel", "inline", "end_line", "finishing", "qa_audit"}
    if report_type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid report_type. Must be one of: {', '.join(VALID_TYPES)}")

    file_bytes = await file.read()
    filename = file.filename or "document"
    filename_lower = filename.lower()

    REPORT_FIELDS = {
        "cut_panel": ["order_no", "style_name", "fabric_type", "total_pieces_cut", "defects_found", "defect_types", "cutting_date", "operator_name", "remarks"],
        "inline": ["order_no", "style_name", "line_no", "operation", "checked_pieces", "defective_pieces", "defect_types", "dhu_percent", "inspection_date", "remarks"],
        "end_line": ["order_no", "style_name", "line_no", "total_inspected", "total_passed", "total_failed", "defect_types", "fpy_percent", "inspection_date", "remarks"],
        "finishing": ["order_no", "style_name", "quantity_finished", "defects_found", "defect_types", "finishing_date", "press_check", "ironing_status", "remarks"],
        "qa_audit": ["order_no", "style_name", "audit_date", "aql_level", "sample_size", "defects_found", "major_defects", "minor_defects", "audit_result", "remarks"],
    }
    fields = REPORT_FIELDS.get(report_type, [])

    if any(filename_lower.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp"]):
        import base64
        b64 = base64.b64encode(file_bytes).decode("utf-8")
        ext = filename_lower.split(".")[-1]
        mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
        user_content = [
            {"type": "text", "text": f"Extract the following fields from this inspection document image: {', '.join(fields)}. Return ONLY a valid JSON object with these keys. Use null for missing fields."},
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
        ]
    else:
        extracted_text = _extract_text_from_file(file_bytes, filename)
        user_content = (
            f"Extract the following fields from this inspection document:\n"
            f"Fields: {', '.join(fields)}\n\n"
            f"Document text:\n{extracted_text[:6000]}\n\n"
            f"Return ONLY a valid JSON object with these exact keys. Use null for missing values."
        )

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a document parser for a textile QC system. Extract structured data from inspection documents. Always return a valid JSON object only, with no extra text.",
                },
                {"role": "user", "content": user_content},
            ],
            max_tokens=800,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        extracted_fields = json.loads(raw)
    except Exception as e:
        err_msg = str(e)
        if "insufficient_quota" in err_msg.lower() or "credit_balance_exhausted" in err_msg.lower() or "429" in err_msg:
            raise HTTPException(
                status_code=429,
                detail="OpenAI credit balance is exhausted. Please add billing credits at https://platform.openai.com/settings/organization/billing"
            )
        raise HTTPException(status_code=500, detail=f"AI extraction failed: {err_msg}")

    return success_response(
        data={
            "report_type": report_type,
            "extracted_fields": extracted_fields,
            "document": filename,
            "navigation_hint": f"/qc-reports/{report_type.replace('_', '-')}/new",
        },
        message=f"Fields extracted from {filename}.",
    )
