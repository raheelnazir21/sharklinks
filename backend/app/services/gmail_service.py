"""
Gmail Service — Google Workspace Service Account Integration.

Uses domain-wide delegation so the backend can scan:
  • Owner's Sent folder   → detect when order emails are sent
  • Manager's Inbox       → detect when manager has received it

Setup (one-time, by Google Workspace admin):
  1. Create a Service Account in Google Cloud Console
  2. Enable Gmail API on the project
  3. Enable Domain-Wide Delegation on the service account
  4. In Google Workspace Admin → Security → API Controls →
     Domain-wide Delegation → Add the service account client_id
     with scope: https://www.googleapis.com/auth/gmail.readonly
  5. Download the JSON key file → save as GMAIL_SERVICE_ACCOUNT_FILE
"""
import os
import re
import base64
import json
import logging
from datetime import datetime, timezone
from typing import Optional
from email import message_from_bytes
from email.header import decode_header

from app.core.config import settings

logger = logging.getLogger(__name__)


# ─── Keyword Patterns ────────────────────────────────────────────────────────

def _get_order_keywords() -> list[str]:
    raw = getattr(settings, "GMAIL_ORDER_KEYWORDS", "order,PO,purchase order,style,bulk,sampling,ex-factory,quantity")
    return [k.strip().lower() for k in raw.split(",") if k.strip()]


# ─── Regex patterns to extract order metadata from email text ────────────────

_ORDER_NO_PATTERNS = [
    re.compile(r'\bPO[-/]?\s*\d{2,6}[-/]?\d*\b', re.I),
    re.compile(r'\border\s*(?:no|number|#|num)[:\s#]*([A-Z0-9/-]+)\b', re.I),
    re.compile(r'\b(?:ref|reference)[:\s#]*([A-Z0-9/-]+)\b', re.I),
]

_STYLE_PATTERNS = [
    re.compile(r'\bstyle[:\s#]*([A-Za-z0-9 _/-]+?)(?:\s*[,\n|]|$)', re.I),
    re.compile(r'\bitem[:\s#]*([A-Za-z0-9 _/-]+?)(?:\s*[,\n|]|$)', re.I),
]

_QTY_PATTERNS = [
    re.compile(r'(\d[\d,]+)\s*(?:pcs?|pieces?|units?|qty)', re.I),
    re.compile(r'(?:qty|quantity)[:\s]*(\d[\d,]+)', re.I),
]


def _decode_header_value(value: str) -> str:
    """Decode RFC 2047-encoded email header values."""
    if not value:
        return ""
    parts = decode_header(value)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(str(part))
    return " ".join(decoded)


def _extract_plain_text(msg) -> str:
    """Extract plain text body from email.message object."""
    text = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                payload = part.get_payload(decode=True)
                if payload:
                    text += payload.decode("utf-8", errors="replace") + "\n"
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            text = payload.decode("utf-8", errors="replace")
    return text[:2000]   # cap at 2000 chars to avoid huge blobs


def _parse_order_hints(text: str) -> dict:
    """Try to extract order_no, style_name, and quantity from raw email text."""
    order_no = None
    style_name = None
    quantity = None

    for pat in _ORDER_NO_PATTERNS:
        m = pat.search(text)
        if m:
            order_no = m.group(0).strip()
            break

    for pat in _STYLE_PATTERNS:
        m = pat.search(text)
        if m:
            style_name = (m.group(1) or m.group(0)).strip()[:100]
            break

    for pat in _QTY_PATTERNS:
        m = pat.search(text)
        if m:
            qty_str = m.group(1).replace(",", "")
            try:
                quantity = int(qty_str)
            except ValueError:
                pass
            break

    return {"order_no": order_no, "style_name": style_name, "quantity": quantity}


def _is_order_email(subject: str, body_snippet: str) -> tuple[bool, list[str]]:
    """
    Returns (is_order_email, matched_keywords).
    True if subject OR body contains at least one configured order keyword.
    """
    keywords = _get_order_keywords()
    combined = f"{subject} {body_snippet}".lower()
    matched = [kw for kw in keywords if kw in combined]
    return len(matched) > 0, matched


# ─── Gmail API Client Factory ─────────────────────────────────────────────────

def _build_gmail_service(impersonate_email: str):
    """
    Build an authenticated Gmail API service client for *impersonate_email*
    using a Service Account with domain-wide delegation.

    Raises RuntimeError if the service account file is missing or invalid.
    """
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
    except ImportError:
        raise RuntimeError(
            "Google API libraries not installed. "
            "Run: pip install google-api-python-client google-auth google-auth-httplib2"
        )

    sa_file = getattr(settings, "GMAIL_SERVICE_ACCOUNT_FILE", "")
    if not sa_file or not os.path.exists(sa_file):
        raise RuntimeError(
            f"GMAIL_SERVICE_ACCOUNT_FILE not found: '{sa_file}'. "
            "Download the Service Account JSON key from Google Cloud Console."
        )

    scopes = ["https://www.googleapis.com/auth/gmail.readonly"]

    credentials = service_account.Credentials.from_service_account_file(
        sa_file, scopes=scopes
    )
    delegated = credentials.with_subject(impersonate_email)

    service = build("gmail", "v1", credentials=delegated, cache_discovery=False)
    return service


# ─── Email Fetching ───────────────────────────────────────────────────────────

def _get_email_addresses(accounts_csv: str) -> list[str]:
    """Parse comma-separated email addresses from config."""
    if not accounts_csv:
        return []
    return [e.strip() for e in accounts_csv.split(",") if e.strip()]


def fetch_sent_emails(since_hours: int = 48) -> list[dict]:
    """
    Fetch emails from the owner's Sent folder sent in the last *since_hours*.
    Filters to only emails that look like order communications.
    Returns a list of parsed email dicts.
    """
    owner_emails = _get_email_addresses(
        getattr(settings, "GMAIL_OWNER_EMAILS", "")
    )
    results = []
    for owner_email in owner_emails:
        try:
            msgs = _scan_mailbox(
                email_address=owner_email,
                folder="SENT",
                since_hours=since_hours
            )
            results.extend(msgs)
        except Exception as e:
            logger.error(f"[GmailService] Error scanning SENT for {owner_email}: {e}")
    return results


def fetch_manager_inbox_emails(since_hours: int = 48) -> list[dict]:
    """
    Fetch emails from registered manager inboxes.
    Uses GMAIL_MANAGER_EMAILS config (comma-separated).
    """
    manager_emails = _get_email_addresses(
        getattr(settings, "GMAIL_MANAGER_EMAILS", "")
    )
    results = []
    for mgr_email in manager_emails:
        try:
            msgs = _scan_mailbox(
                email_address=mgr_email,
                folder="INBOX",
                since_hours=since_hours
            )
            results.extend(msgs)
        except Exception as e:
            logger.error(f"[GmailService] Error scanning INBOX for {mgr_email}: {e}")
    return results


def _scan_mailbox(email_address: str, folder: str, since_hours: int) -> list[dict]:
    """
    Core scanner: authenticates as *email_address*, fetches messages from *folder*
    that arrived in the last *since_hours*, parses them, and returns order-like emails.
    """
    service = _build_gmail_service(email_address)

    # Build Gmail search query
    import time as _time
    epoch_cutoff = int(_time.time()) - (since_hours * 3600)
    query = f"after:{epoch_cutoff}"
    if folder == "SENT":
        query = f"in:sent {query}"
    else:
        query = f"in:inbox {query}"

    max_results = int(getattr(settings, "GMAIL_SCAN_MAX_RESULTS", 100))

    try:
        response = service.users().messages().list(
            userId="me",
            q=query,
            maxResults=max_results
        ).execute()
    except Exception as e:
        logger.error(f"[GmailService] Gmail API list error for {email_address}: {e}")
        return []

    messages = response.get("messages", [])
    if not messages:
        return []

    parsed_emails = []
    for msg_stub in messages:
        try:
            parsed = _fetch_and_parse_message(service, msg_stub["id"], email_address, folder)
            if parsed:
                parsed_emails.append(parsed)
        except Exception as e:
            logger.warning(f"[GmailService] Could not parse message {msg_stub['id']}: {e}")

    return parsed_emails


def _fetch_and_parse_message(service, message_id: str, scanned_account: str, folder: str) -> Optional[dict]:
    """
    Fetch a single Gmail message by ID, parse headers + body,
    run keyword filter. Returns parsed dict or None if not order-like.
    """
    raw_msg = service.users().messages().get(
        userId="me", id=message_id, format="raw"
    ).execute()

    raw_data = base64.urlsafe_b64decode(raw_msg.get("raw", ""))
    msg = message_from_bytes(raw_data)

    subject     = _decode_header_value(msg.get("Subject", ""))
    sender      = _decode_header_value(msg.get("From", ""))
    to_header   = _decode_header_value(msg.get("To", ""))
    cc_header   = _decode_header_value(msg.get("Cc", ""))
    date_header = msg.get("Date", "")
    thread_id   = raw_msg.get("threadId", "")

    # Parse date
    try:
        from email.utils import parsedate_to_datetime
        email_date = parsedate_to_datetime(date_header)
        if email_date.tzinfo:
            email_date = email_date.astimezone(timezone.utc).replace(tzinfo=None)
    except Exception:
        email_date = datetime.utcnow()

    # Parse recipients
    recipient_emails = [
        e.strip().strip("<>")
        for e in re.split(r"[,;]", f"{to_header},{cc_header}")
        if "@" in e
    ]

    # Extract body
    body_text   = _extract_plain_text(msg)
    body_snippet = body_text[:500]

    # Filter: is this an order email?
    is_order, matched_kws = _is_order_email(subject, body_snippet)
    if not is_order:
        return None

    # Parse order hints from full text
    full_text = f"{subject} {body_text}"
    hints = _parse_order_hints(full_text)

    return {
        "gmail_message_id":     message_id,
        "gmail_thread_id":      thread_id,
        "subject":              subject,
        "sender_email":         scanned_account if folder == "SENT" else _extract_email_addr(sender),
        "recipient_emails":     list(set(recipient_emails)),
        "body_snippet":         body_snippet,
        "email_date":           email_date,
        "detected_order_no":    hints["order_no"],
        "detected_style_name":  hints["style_name"],
        "detected_quantity":    hints["quantity"],
        "detected_keywords":    matched_kws,
        "folder":               folder,
        "scanned_account":      scanned_account,
    }


def _extract_email_addr(raw: str) -> str:
    """Extract plain email address from 'Name <email@domain.com>' format."""
    m = re.search(r"<([^>]+)>", raw)
    return m.group(1).strip() if m else raw.strip()
