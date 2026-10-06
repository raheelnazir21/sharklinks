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


# ─── Specialized Production Order Reminder Templates ─────────────────────────

def _format_qty(val) -> str:
    try:
        return f"{int(val):,} pcs"
    except (ValueError, TypeError):
        return str(val) if val else "0 pcs"


def build_partial_order_email(order: dict, custom_note: str = "") -> tuple[str, str]:
    """
    Template 1: Partial Order Reminder.
    Sent when production is partially complete or stuck in mid-stages and requires review.
    """
    order_no     = order.get("order_no") or order.get("id", "PO-UNASSIGNED")[:8]
    style_name   = order.get("style_name") or order.get("product_name") or "Standard Style"
    customer     = order.get("customer") or order.get("customer_name") or "Direct Client"
    vendor_name  = order.get("vendor_name") or "Primary Facility"
    total_qty    = order.get("quantity") or 0
    done_qty     = order.get("completed_quantity") or order.get("produced_quantity") or int(total_qty * 0.45)
    pending_qty  = max(0, total_qty - done_qty)
    pct_done     = int((done_qty / total_qty * 100)) if total_qty > 0 else 45
    ex_factory   = str(order.get("ex_factory_date") or "TBD")
    current_stage= order.get("current_stage") or "Stitching / Sewing Floor"
    order_id     = str(order.get("id") or "")
    dashboard_url= f"{settings.APP_BASE_URL}/orders/{order_id}" if order_id else f"{settings.APP_BASE_URL}/orders"

    subject = f"⏳ [ACTION NEEDED] Partial Order Progress Review: PO #{order_no} — {style_name} ({pct_done}% Complete)"

    note_section = ""
    if custom_note or order.get("remarks"):
        note_text = custom_note or order.get("remarks")
        note_section = f"""
        <div style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;padding:14px 16px;border-radius:6px;margin:20px 0;">
          <div style="font-size:12px;font-weight:700;color:#b45309;text-transform:uppercase;margin-bottom:4px;">Operational Note:</div>
          <div style="font-size:13px;color:#92400e;line-height:1.5;">{note_text}</div>
        </div>
        """

    body = f"""
    <p style="font-size:15px;color:#1e293b;margin:0 0 16px;line-height:1.5;">
      Attention <strong>Production &amp; Merchandising Team</strong>,
    </p>
    <p style="font-size:14px;color:#475569;margin:0 0 20px;line-height:1.5;">
      This is an automated progress check for <strong>PO #{order_no}</strong>. The order is currently in a 
      <span style="display:inline-block;background:#fef3c7;color:#92400e;font-weight:700;padding:2px 8px;border-radius:4px;">PARTIAL STATE</span>
      and requires supervisory review to expedite remaining output.
    </p>

    <!-- Progress Metric Cards -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td width="32%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600;">Total Ordered</div>
          <div style="font-size:18px;font-weight:800;color:#0f172a;margin-top:4px;">{_format_qty(total_qty)}</div>
        </td>
        <td width="2%"></td>
        <td width="32%" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;text-align:center;">
          <div style="font-size:11px;color:#15803d;text-transform:uppercase;font-weight:600;">Completed Units</div>
          <div style="font-size:18px;font-weight:800;color:#16a34a;margin-top:4px;">{_format_qty(done_qty)}</div>
        </td>
        <td width="2%"></td>
        <td width="32%" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px;text-align:center;">
          <div style="font-size:11px;color:#c2410c;text-transform:uppercase;font-weight:600;">Balance Pending</div>
          <div style="font-size:18px;font-weight:800;color:#ea580c;margin-top:4px;">{_format_qty(pending_qty)}</div>
        </td>
      </tr>
    </table>

    <!-- Visual Progress Bar -->
    <div style="background:#f1f5f9;border-radius:8px;height:14px;overflow:hidden;margin:16px 0 6px;">
      <div style="background:linear-gradient(90deg, #f59e0b, #10b981);height:14px;width:{pct_done}%;border-radius:8px;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:20px;">
      <span>Overall Production Progress: <strong>{pct_done}%</strong></span>
      <span>Active Stage: <strong style="color:#0f172a;">{current_stage}</strong></span>
    </div>

    <!-- Specifications Table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:16px 0;font-size:13px;">
      <tr style="background:#f8fafc;">
        <td style="padding:10px 14px;color:#64748b;font-weight:600;width:35%;border-bottom:1px solid #e2e8f0;">Order / PO Number</td>
        <td style="padding:10px 14px;color:#0f172a;font-weight:700;border-bottom:1px solid #e2e8f0;">{order_no}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Style / Product</td>
        <td style="padding:10px 14px;color:#0f172a;font-weight:600;border-bottom:1px solid #e2e8f0;">{style_name}</td>
      </tr>
      <tr style="background:#f8fafc;">
        <td style="padding:10px 14px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Customer / Brand</td>
        <td style="padding:10px 14px;color:#0f172a;font-weight:600;border-bottom:1px solid #e2e8f0;">{customer}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Manufacturing Facility</td>
        <td style="padding:10px 14px;color:#0f172a;font-weight:600;border-bottom:1px solid #e2e8f0;">{vendor_name}</td>
      </tr>
      <tr style="background:#f8fafc;">
        <td style="padding:10px 14px;color:#64748b;font-weight:600;">Ex-Factory Target Date</td>
        <td style="padding:10px 14px;color:#0f172a;font-weight:700;">{ex_factory}</td>
      </tr>
    </table>

    {note_section}

    <!-- Immediate Action Checklist -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:20px 0;">
      <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px;">📋 Recommended Operational Checklist:</div>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#475569;line-height:1.6;">
        <li>Confirm balance raw material &amp; trims availability at line feeding.</li>
        <li>Review hourly output in <strong>{current_stage}</strong> to prevent bottlenecking.</li>
        <li>Update partial batch audit or inline QC reports for completed garments.</li>
      </ul>
    </div>
    """

    html = _base_template(
        title=f"Partial Order Review — PO #{order_no}",
        badge_color="#d97706",
        badge_label="⏳ Partial In-Progress",
        body_html=body,
        cta_url=dashboard_url,
        cta_label="Review & Update Order Details →",
    )
    return subject, html


def build_date_delay_email(order: dict, custom_note: str = "") -> tuple[str, str]:
    """
    Template 2: Date Delay / Schedule Escalation Alert.
    Sent when an order has breached or is at imminent risk of breaching its ex-factory target.
    """
    order_no     = order.get("order_no") or order.get("id", "PO-UNASSIGNED")[:8]
    style_name   = order.get("style_name") or order.get("product_name") or "Standard Style"
    customer     = order.get("customer") or order.get("customer_name") or "Direct Client"
    vendor_name  = order.get("vendor_name") or "Primary Facility"
    total_qty    = order.get("quantity") or 0
    ex_factory   = str(order.get("ex_factory_date") or "TBD")
    days_delayed = order.get("days_delayed") or order.get("delay_days") or 4
    recovery_date= str(order.get("recovery_date") or "Pending Review")
    current_stage= order.get("current_stage") or "Stitching Line Delay"
    delay_reason = order.get("delay_reason") or "Fabric delivery delay / Machine breakdown"
    delay_capa   = order.get("delay_capa") or "Overtime authorized + auxiliary line deployed"
    order_id     = str(order.get("id") or "")
    dashboard_url= f"{settings.APP_BASE_URL}/orders/{order_id}" if order_id else f"{settings.APP_BASE_URL}/orders"

    subject = f"🚨 [CRITICAL DELAY] PO #{order_no} — {style_name} is {days_delayed} Day(s) Behind Ex-Factory Schedule"

    note_section = ""
    if custom_note:
        note_section = f"""
        <div style="background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;padding:14px 16px;border-radius:6px;margin:20px 0;">
          <div style="font-size:12px;font-weight:700;color:#991b1b;text-transform:uppercase;margin-bottom:4px;">Urgent Directive:</div>
          <div style="font-size:13px;color:#7f1d1d;line-height:1.5;">{custom_note}</div>
        </div>
        """

    body = f"""
    <p style="font-size:15px;color:#1e293b;margin:0 0 16px;line-height:1.5;">
      High Priority Alert for <strong>Factory Operations &amp; Production Control</strong>,
    </p>
    <p style="font-size:14px;color:#475569;margin:0 0 20px;line-height:1.5;">
      Order <strong>PO #{order_no}</strong> for client <strong>{customer}</strong> has exceeded its delivery milestone 
      and is currently flagged as <span style="display:inline-block;background:#fee2e2;color:#b91c1c;font-weight:800;padding:2px 8px;border-radius:4px;">CRITICAL DATE DELAY</span>.
    </p>

    <!-- Urgency Highlight Banner -->
    <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:16px 20px;margin:16px 0 24px;text-align:center;">
      <div style="font-size:12px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:1px;">Schedule Breach Metric</div>
      <div style="font-size:32px;font-weight:900;color:#dc2626;margin:6px 0;">+{days_delayed} DAYS DELAYED</div>
      <div style="font-size:13px;color:#7f1d1d;">Original Ex-Factory Deadline: <strong>{ex_factory}</strong></div>
    </div>

    <!-- Timeline & Impact Breakdown -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:16px 0;font-size:13px;">
      <tr style="background:#f8fafc;">
        <td style="padding:10px 14px;color:#64748b;font-weight:600;width:35%;border-bottom:1px solid #e2e8f0;">Original Ex-Factory</td>
        <td style="padding:10px 14px;color:#dc2626;font-weight:700;text-decoration:line-through;border-bottom:1px solid #e2e8f0;">{ex_factory}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Estimated Recovery Date</td>
        <td style="padding:10px 14px;color:#0f172a;font-weight:700;border-bottom:1px solid #e2e8f0;">{recovery_date}</td>
      </tr>
      <tr style="background:#f8fafc;">
        <td style="padding:10px 14px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Bottleneck Stage</td>
        <td style="padding:10px 14px;color:#b91c1c;font-weight:700;border-bottom:1px solid #e2e8f0;">{current_stage}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Order Quantity at Risk</td>
        <td style="padding:10px 14px;color:#0f172a;font-weight:700;border-bottom:1px solid #e2e8f0;">{_format_qty(total_qty)}</td>
      </tr>
      <tr style="background:#f8fafc;">
        <td style="padding:10px 14px;color:#64748b;font-weight:600;">Assigned Vendor</td>
        <td style="padding:10px 14px;color:#0f172a;font-weight:600;">{vendor_name}</td>
      </tr>
    </table>

    <!-- Delay Reason & CAPA Section -->
    <div style="background:#fff;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;">
      <div style="font-size:12px;font-weight:700;color:#991b1b;text-transform:uppercase;margin-bottom:6px;">Root Cause &amp; CAPA Plan:</div>
      <div style="font-size:13px;color:#1e293b;margin-bottom:8px;"><strong>Reported Cause:</strong> {delay_reason}</div>
      <div style="font-size:13px;color:#1e293b;"><strong>Corrective Action (CAPA):</strong> {delay_capa}</div>
    </div>

    {note_section}

    <!-- Escalation Directives -->
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;">
      <div style="font-size:13px;font-weight:700;color:#991b1b;margin-bottom:8px;">⚠️ Mandatory Escalation Protocol:</div>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#7f1d1d;line-height:1.6;">
        <li>Convene immediate stand-up with floor manager &amp; industrial engineering team.</li>
        <li>Confirm revised air/sea freight booking window with customer merchant.</li>
        <li>Log updated daily production output targets on the tracking portal.</li>
      </ul>
    </div>
    """

    html = _base_template(
        title=f"Schedule Delay Escalation — PO #{order_no}",
        badge_color="#dc2626",
        badge_label=f"🚨 {days_delayed} Days Overdue",
        body_html=body,
        cta_url=dashboard_url,
        cta_label="Open Delay & CAPA Manager →",
    )
    return subject, html


def build_order_complete_email(order: dict, custom_note: str = "") -> tuple[str, str]:
    """
    Template 3: Order Completed / Final Sign-Off Notification.
    Sent when all production stages are finished, final QC has passed, and goods are ready for dispatch.
    """
    order_no     = order.get("order_no") or order.get("id", "PO-UNASSIGNED")[:8]
    style_name   = order.get("style_name") or order.get("product_name") or "Standard Style"
    customer     = order.get("customer") or order.get("customer_name") or "Direct Client"
    vendor_name  = order.get("vendor_name") or "Primary Facility"
    total_qty    = order.get("quantity") or 0
    completed_qty= order.get("completed_quantity") or total_qty
    completion_dt= str(order.get("completion_date") or datetime.utcnow().strftime("%Y-%m-%d"))
    qc_status    = order.get("qc_status") or order.get("qa_audit_status") or "PASSED (AQL 1.5)"
    order_id     = str(order.get("id") or "")
    dashboard_url= f"{settings.APP_BASE_URL}/orders/{order_id}" if order_id else f"{settings.APP_BASE_URL}/orders"

    subject = f"✅ [ORDER COMPLETE & DISPATCH READY] PO #{order_no} — {style_name} ({_format_qty(completed_qty)})"

    note_section = ""
    if custom_note:
        note_section = f"""
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #16a34a;padding:14px 16px;border-radius:6px;margin:20px 0;">
          <div style="font-size:12px;font-weight:700;color:#15803d;text-transform:uppercase;margin-bottom:4px;">Closing Remarks:</div>
          <div style="font-size:13px;color:#166534;line-height:1.5;">{custom_note}</div>
        </div>
        """

    body = f"""
    <p style="font-size:15px;color:#1e293b;margin:0 0 16px;line-height:1.5;">
      Dear <strong>Client &amp; Logistics Partners</strong>,
    </p>
    <p style="font-size:14px;color:#475569;margin:0 0 20px;line-height:1.5;">
      We are pleased to notify you that manufacturing and quality auditing for 
      <strong>PO #{order_no}</strong> ({style_name}) have been 
      <span style="display:inline-block;background:#dcfce7;color:#15803d;font-weight:800;padding:2px 8px;border-radius:4px;">SUCCESSFULLY COMPLETED</span>.
      The consignment is packaged, tagged, and released for final handover.
    </p>

    <!-- Completed Milestone Banner -->
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:20px;margin:16px 0 24px;text-align:center;">
      <div style="font-size:12px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:1px;">Milestone Achieved</div>
      <div style="font-size:30px;font-weight:900;color:#16a34a;margin:6px 0;">100% PRODUCTION COMPLETED</div>
      <div style="font-size:14px;color:#166534;font-weight:600;">Total Quantity Released: {_format_qty(completed_qty)}</div>
    </div>

    <!-- Specifications Table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:16px 0;font-size:13px;">
      <tr style="background:#f8fafc;">
        <td style="padding:10px 14px;color:#64748b;font-weight:600;width:35%;border-bottom:1px solid #e2e8f0;">Order / PO Number</td>
        <td style="padding:10px 14px;color:#0f172a;font-weight:700;border-bottom:1px solid #e2e8f0;">{order_no}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Customer / Brand</td>
        <td style="padding:10px 14px;color:#0f172a;font-weight:600;border-bottom:1px solid #e2e8f0;">{customer}</td>
      </tr>
      <tr style="background:#f8fafc;">
        <td style="padding:10px 14px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Style / Product</td>
        <td style="padding:10px 14px;color:#0f172a;font-weight:600;border-bottom:1px solid #e2e8f0;">{style_name}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Final Quality Inspection</td>
        <td style="padding:10px 14px;color:#15803d;font-weight:700;border-bottom:1px solid #e2e8f0;">{qc_status}</td>
      </tr>
      <tr style="background:#f8fafc;">
        <td style="padding:10px 14px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Manufacturing Facility</td>
        <td style="padding:10px 14px;color:#0f172a;font-weight:600;border-bottom:1px solid #e2e8f0;">{vendor_name}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;color:#64748b;font-weight:600;">Completion Date</td>
        <td style="padding:10px 14px;color:#0f172a;font-weight:700;">{completion_dt}</td>
      </tr>
    </table>

    {note_section}

    <!-- Post-Completion Next Steps -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:20px 0;">
      <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px;">📦 Handover &amp; Dispatch Checklist:</div>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#475569;line-height:1.6;">
        <li>Inspection Certificate &amp; Batch Audit report attached to order record.</li>
        <li>Carton packing list verified against export carton barcodes.</li>
        <li>Goods staged in dispatch bay ready for forwarder collection.</li>
      </ul>
    </div>
    """

    html = _base_template(
        title=f"Order Completed — PO #{order_no}",
        badge_color="#16a34a",
        badge_label="✅ 100% Completed",
        body_html=body,
        cta_url=dashboard_url,
        cta_label="View Final Order & QC Dossier →",
    )
    return subject, html


def send_order_status_reminder(
    template_type: str,
    order: dict,
    recipients: list[str],
    cc_emails: list[str] = None,
    custom_note: str = "",
    subject_override: str = "",
) -> dict:
    """
    Unified dispatcher to send any of the 3 production reminder templates:
      - 'partial'
      - 'date_delay'
      - 'order_complete'
    """
    cc_list = cc_emails or []
    if template_type == "partial":
        default_subject, html = build_partial_order_email(order, custom_note)
    elif template_type == "date_delay":
        default_subject, html = build_date_delay_email(order, custom_note)
    elif template_type == "order_complete":
        default_subject, html = build_order_complete_email(order, custom_note)
    else:
        raise ValueError(f"Unknown template_type '{template_type}'. Must be one of: partial, date_delay, order_complete.")

    subject = subject_override.strip() if subject_override else default_subject
    all_recipients = list(set([r.strip() for r in recipients if r.strip()] + [c.strip() for c in cc_list if c.strip()]))
    
    if not all_recipients:
        raise ValueError("At least one recipient email must be specified.")

    msg = _build_message(to=recipients, cc=cc_list, subject=subject, html_body=html)
    _send_or_dryrun(msg, all_recipients)

    return {
        "status": "success",
        "template_type": template_type,
        "subject": subject,
        "recipients": recipients,
        "cc": cc_list,
        "dry_run": settings.EMAIL_DRY_RUN,
    }

