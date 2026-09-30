"""
Email Service — SMTP email sender for Pre-Order accountability notifications.
Uses Python's built-in smtplib. Supports EMAIL_DRY_RUN mode (writes to disk).
"""
import os
import smtplib
import logging
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def _build_message(
    to: list[str],
    cc: list[str],
    subject: str,
    html_body: str,
) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>"
    msg["To"]      = ", ".join(to)
    if cc:
        msg["Cc"] = ", ".join(cc)
    if settings.EMAIL_REPLY_TO:
        msg["Reply-To"] = settings.EMAIL_REPLY_TO
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    return msg


def _send_or_dryrun(msg: MIMEMultipart, all_recipients: list[str]) -> None:
    if settings.EMAIL_DRY_RUN:
        # Write to disk so you can preview the email before using real SMTP
        os.makedirs(settings.EMAIL_OUTBOX_DIR, exist_ok=True)
        filename = f"{settings.EMAIL_OUTBOX_DIR}/{datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')}.html"
        with open(filename, "w", encoding="utf-8") as f:
            f.write(f"<!-- TO: {msg['To']} -->\n")
            f.write(f"<!-- CC: {msg.get('Cc', '')} -->\n")
            f.write(f"<!-- SUBJECT: {msg['Subject']} -->\n\n")
            for part in msg.get_payload():
                if part.get_content_type() == "text/html":
                    f.write(part.get_payload(decode=True).decode("utf-8"))
        logger.info(f"[EmailService][DRY-RUN] Email saved to {filename}")
        return

    if not settings.SMTP_HOST:
        logger.warning("[EmailService] SMTP_HOST not configured — email skipped.")
        return

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAIL_FROM, all_recipients, msg.as_string())
        logger.info(f"[EmailService] Email sent to {all_recipients}")
    except Exception as e:
        logger.error(f"[EmailService] Failed to send email: {e}")


def _base_template(title: str, badge_color: str, badge_label: str, body_html: str, cta_url: str = "", cta_label: str = "View in Dashboard") -> str:
    cta_block = ""
    if cta_url:
        cta_block = f"""
        <div style="text-align:center;margin:32px 0;">
          <a href="{cta_url}"
             style="background:{badge_color};color:#fff;text-decoration:none;padding:12px 28px;
                    border-radius:8px;font-weight:600;font-size:14px;display:inline-block;">
            {cta_label}
          </a>
        </div>"""

    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:{badge_color};padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:11px;color:rgba(255,255,255,0.8);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">
                    Textile Production &amp; QC System
                  </div>
                  <div style="font-size:20px;font-weight:700;color:#ffffff;">{title}</div>
                </td>
                <td align="right">
                  <span style="background:rgba(255,255,255,0.2);color:#fff;padding:4px 12px;
                               border-radius:20px;font-size:12px;font-weight:600;">
                    {badge_label}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            {body_html}
            {cta_block}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#f8fafb;border-top:1px solid #eef1f0;">
            <p style="margin:0;font-size:12px;color:#8a9ba8;">
              This is an automated message from the Textile Production &amp; QC Analysis System.
              Do not reply directly to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _order_details_table(req: dict) -> str:
    rows = ""
    fields = [
        ("Class Name",    req.get("class_name", "—")),
        ("Category",      req.get("category", "—").title()),
        ("Style Name",    req.get("style_name") or "—"),
        ("Customer",      req.get("customer") or "—"),
        ("Reference PO",  req.get("reference_po") or "—"),
        ("Quantity",      f"{req.get('quantity'):,} pcs" if req.get("quantity") else "—"),
        ("Ex-Factory",    str(req.get("ex_factory_date", "—"))),
        ("Priority",      req.get("priority", "normal").upper()),
        ("Vendor",        req.get("vendor_name") or "—"),
        ("Assigned By",   req.get("assigned_by_name", "—")),
    ]
    for label, value in fields:
        rows += f"""
        <tr>
          <td style="padding:8px 12px;font-size:13px;color:#64748b;font-weight:500;
                     width:40%;border-bottom:1px solid #f1f5f9;">{label}</td>
          <td style="padding:8px 12px;font-size:13px;color:#1e293b;font-weight:600;
                     border-bottom:1px solid #f1f5f9;">{value}</td>
        </tr>"""
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:16px 0;">
      {rows}
    </table>"""


# ─── Public API ───────────────────────────────────────────────────────────────

def send_assignment_email(req: dict, manager_email: str, cc_emails: list[str]) -> None:
    """Instant email when a pre-order is assigned to a manager."""
    class_name = req.get("class_name", "Unnamed")
    category   = req.get("category", "").title()
    ex_fac     = req.get("ex_factory_date", "TBD")
    manager_name = req.get("assigned_manager_name", "Manager")
    assigned_by  = req.get("assigned_by_name", "Admin")
    dashboard_url = f"{settings.APP_BASE_URL}/pre-orders"

    body = f"""
    <p style="font-size:15px;color:#1e293b;margin:0 0 16px;">
      Hi <strong>{manager_name}</strong>,
    </p>
    <p style="font-size:14px;color:#475569;margin:0 0 20px;">
      A new order has been assigned to you by <strong>{assigned_by}</strong>.
      Please create this order in the production tracking system as soon as possible.
    </p>
    {_order_details_table(req)}
    <div style="background:#fef9c3;border-left:4px solid #f59e0b;padding:12px 16px;
                border-radius:0 6px 6px 0;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">
        ⚠️ Action Required: Please process this order within 48 hours.
        A reminder will be sent automatically if no action is taken.
      </p>
    </div>"""

    if req.get("notes"):
        body += f"""
    <p style="font-size:13px;color:#64748b;margin:16px 0 4px;font-weight:500;">Notes from {assigned_by}:</p>
    <p style="font-size:13px;color:#1e293b;background:#f8fafc;padding:12px;
              border-radius:6px;border:1px solid #e2e8f0;">{req['notes']}</p>"""

    html = _base_template(
        title=f"New Order Assigned — {class_name}",
        badge_color="#0ea5e9",
        badge_label=f"📋 {category}",
        body_html=body,
        cta_url=dashboard_url,
        cta_label="Open Orders to Process →",
    )

    subject = f"[Action Required] New Order Assigned: {class_name} — {category} | Ex-Factory: {ex_fac}"
    msg = _build_message(to=[manager_email], cc=cc_emails, subject=subject, html_body=html)
    _send_or_dryrun(msg, [manager_email] + cc_emails)


def send_reminder_email(req: dict, manager_email: str, cc_emails: list[str], reminder_num: int, hours_overdue: int) -> None:
    """Reminder email (1st = 24h, 2nd = 48h) when manager hasn't created the order yet."""
    class_name   = req.get("class_name", "Unnamed")
    category     = req.get("category", "").title()
    manager_name = req.get("assigned_manager_name", "Manager")
    dashboard_url = f"{settings.APP_BASE_URL}/pre-orders"

    urgency_color = "#f59e0b" if reminder_num == 1 else "#ef4444"
    badge         = "🟠 1st Reminder" if reminder_num == 1 else "🔴 2nd Reminder — Urgent"

    body = f"""
    <p style="font-size:15px;color:#1e293b;margin:0 0 16px;">
      Hi <strong>{manager_name}</strong>,
    </p>
    <p style="font-size:14px;color:#475569;margin:0 0 20px;">
      This is a reminder that the following order was assigned to you
      <strong>{hours_overdue} hours ago</strong> and has <strong>not yet been created</strong>
      in the production tracking system.
    </p>
    {_order_details_table(req)}
    <div style="background:{'#fef9c3' if reminder_num==1 else '#fee2e2'};
                border-left:4px solid {urgency_color};padding:12px 16px;
                border-radius:0 6px 6px 0;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:{'#92400e' if reminder_num==1 else '#991b1b'};font-weight:600;">
        {'⚠️ Please create this order in the system immediately.' if reminder_num==1
          else '🚨 Final reminder before this is escalated to senior management.'}
      </p>
    </div>"""

    html = _base_template(
        title=f"Reminder: Order Not Yet Processed — {class_name}",
        badge_color=urgency_color,
        badge_label=badge,
        body_html=body,
        cta_url=dashboard_url,
        cta_label="Process This Order Now →",
    )

    subject = f"[REMINDER #{reminder_num}] Order Not Processed: {class_name} — {hours_overdue}h Overdue"
    msg = _build_message(to=[manager_email], cc=cc_emails, subject=subject, html_body=html)
    _send_or_dryrun(msg, [manager_email] + cc_emails)


def send_escalation_email(req: dict, super_admin_emails: list[str], cc_emails: list[str]) -> None:
    """Escalation email to super admins when order is unprocessed for 72+ hours."""
    class_name    = req.get("class_name", "Unnamed")
    category      = req.get("category", "").title()
    manager_name  = req.get("assigned_manager_name", "Assigned Manager")
    assigned_at   = req.get("assigned_at", "Unknown")
    dashboard_url = f"{settings.APP_BASE_URL}/pre-orders"

    body = f"""
    <p style="font-size:15px;color:#1e293b;margin:0 0 16px;">
      Hi Team,
    </p>
    <p style="font-size:14px;color:#475569;margin:0 0 20px;">
      The following pre-order has been assigned to <strong>{manager_name}</strong>
      since <strong>{assigned_at}</strong> and has <strong>not been entered into the system</strong>
      despite two reminders being sent.
    </p>
    {_order_details_table(req)}
    <div style="background:#fee2e2;border-left:4px solid #dc2626;padding:12px 16px;
                border-radius:0 6px 6px 0;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:#991b1b;font-weight:600;">
        🚨 Escalation: This order has been unprocessed for 72+ hours.
        Immediate management action is required.
      </p>
    </div>"""

    html = _base_template(
        title=f"ESCALATION — Unprocessed Order: {class_name}",
        badge_color="#dc2626",
        badge_label="🚨 Escalation",
        body_html=body,
        cta_url=dashboard_url,
        cta_label="View All Pending Orders →",
    )

    subject = f"[ESCALATION] {class_name} — Unprocessed for 72h | Assigned to: {manager_name}"
    msg = _build_message(to=super_admin_emails, cc=cc_emails, subject=subject, html_body=html)
    _send_or_dryrun(msg, super_admin_emails + cc_emails)
