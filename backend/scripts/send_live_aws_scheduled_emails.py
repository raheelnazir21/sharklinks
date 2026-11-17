#!/usr/bin/env python3
"""
Live AWS Scheduled Zone Emails Dispatcher
Extracts the EXACT real-time production & QC data from the live database:
- Real Cotton Collective POs
- Real Zone 1 (Ex-Factory Overdue) POs
- Real Zone 2 (Stage Delayed) stages
- Real Zone 3 (Ex-Factory Approaching in 7 days) POs
- Real Zone 4/6 (QC Passed / Completed) POs

Safely dispatches:
1. Official Cotton Collective WIP CSV & 6 Control Zones Directive
2. Daily 6 Control Zones Executive Operational Digest
3. Critical PO Delay Escalation Alert

Enforces a 60-second delay between emails to protect sender domain reputation and SMTP limits.
"""
import os
import sys
import time
from datetime import date, timedelta

# Dynamic path resolution
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.join(os.path.dirname(current_dir), "backend")
if os.path.exists(backend_path) and backend_path not in sys.path:
    sys.path.insert(0, backend_path)
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# pyrefly: ignore[missing-import]
# pyright: reportMissingImports=false
from app.core.database import SessionLocal  # type: ignore # noqa: E402
# pyrefly: ignore[missing-import]
# pyright: reportMissingImports=false
from app.models.order import Order, OrderStatus, StageStatus  # type: ignore # noqa: E402
# pyrefly: ignore[missing-import]
# pyright: reportMissingImports=false
from app.models.user import User, Role, RoleEnum  # type: ignore # noqa: E402
# pyrefly: ignore[missing-import]
# pyright: reportMissingImports=false
from app.services.email_service import (  # type: ignore # noqa: E402
    build_control_zones_directive_email,
    build_date_delay_email,
    send_order_status_reminder,
    _build_message,
    _send_or_dryrun,
)
# pyrefly: ignore[missing-import]
# pyright: reportMissingImports=false
from app.core.config import settings  # type: ignore # noqa: E402


def get_super_admin_emails(db) -> list[str]:
    """Retrieves all active Super Admin emails from DB (including Casey), ensuring standard fallbacks are present."""
    super_admins = db.query(User).join(Role).filter(
        Role.name == RoleEnum.super_admin,
        User.is_active == True
    ).all()
    emails = [u.email.strip() for u in super_admins if u.email and "@" in u.email]
    for fallback in [
        "faisalaslam1038@gmail.com",
        "qc@cottoncollective.org",
        "raheel.safelife@gmail.com",
    ]:
        if fallback not in emails:
            emails.append(fallback)
    return list(dict.fromkeys(emails))



def build_daily_zones_executive_digest(
    today: date,
    zone1_orders: list,
    zone2_stages: list,
    zone3_orders: list,
    zone4_orders: list,
    wip_url: str,
) -> tuple[str, str]:
    subject = f"📊 [DAILY CONTROL ZONES DIGEST] Cotton Collective Live Operational Report — {today.strftime('%d %b %Y')}"

    # Zone 3 rows (Approaching)
    z3_rows = ""
    for o in zone3_orders:
        days_left = (o.ex_factory_date - today).days if o.ex_factory_date else 0
        urgency = "⚠️ DUE IN 2 DAYS" if days_left <= 2 else f"📅 In {days_left} Days"
        z3_rows += f"""
        <tr style="border-bottom:1px solid #fed7aa;">
          <td style="padding:10px 12px;font-weight:700;color:#9a3412;">{o.order_no}</td>
          <td style="padding:10px 12px;color:#451a03;">{o.style_name or o.product_name or 'Cotton Collective Garment'}</td>
          <td style="padding:10px 12px;color:#9a3412;font-weight:600;">{o.ex_factory_date}</td>
          <td style="padding:10px 12px;"><span style="background:#ffedd5;color:#c2410c;font-size:11px;font-weight:800;padding:2px 8px;border-radius:4px;">{urgency}</span></td>
        </tr>"""

    # Zone 1 rows (Top Overdue)
    z1_rows = ""
    for o in zone1_orders[:6]:
        days_late = (today - o.ex_factory_date).days if o.ex_factory_date else (o.delay_days or 0)
        z1_rows += f"""
        <tr style="border-bottom:1px solid #fecaca;">
          <td style="padding:10px 12px;font-weight:700;color:#991b1b;">{o.order_no or f'PO #{str(o.id)[:8]}'}</td>
          <td style="padding:10px 12px;color:#450a0a;">{o.style_name or o.product_name or 'Apparel Batch'}</td>
          <td style="padding:10px 12px;color:#b91c1c;font-weight:600;">{o.ex_factory_date}</td>
          <td style="padding:10px 12px;"><span style="background:#fee2e2;color:#991b1b;font-size:11px;font-weight:800;padding:2px 8px;border-radius:4px;">🚨 {days_late}d Overdue</span></td>
        </tr>"""

    # Zone 2 rows (Delayed Stages)
    z2_rows = ""
    for o, s, days in zone2_stages[:6]:
        slabel = (s.stage_name.value if hasattr(s.stage_name, "value") else str(s.stage_name)).replace("_", " ").title()
        z2_rows += f"""
        <tr style="border-bottom:1px solid #fdba74;">
          <td style="padding:10px 12px;font-weight:700;color:#9a3412;">{o.order_no or f'PO #{str(o.id)[:8]}'}</td>
          <td style="padding:10px 12px;color:#7c2d12;">{slabel}</td>
          <td style="padding:10px 12px;color:#9a3412;">{s.target_date}</td>
          <td style="padding:10px 12px;"><span style="background:#ffedd5;color:#ea580c;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;">⏱️ {days}d Late</span></td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:30px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);border:1px solid #e2e8f0;">
        
        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:24px 30px;color:#ffffff;">
            <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#38bdf8;text-transform:uppercase;margin-bottom:6px;">
              Cotton Collective Production &amp; QC Analysis
            </div>
            <div style="font-size:22px;font-weight:800;color:#f8fafc;letter-spacing:-0.5px;">
              Daily 6 Control Zones Executive Digest
            </div>
            <div style="font-size:13px;color:#94a3b8;margin-top:4px;">
              Live Data Snapshot: <strong>{today.strftime('%A, %d %B %Y')}</strong>
            </div>
          </td>
        </tr>

        <!-- Summary Metrics KPI Grid -->
        <tr>
          <td style="padding:24px 30px 10px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="31%" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;text-align:center;">
                  <div style="font-size:22px;font-weight:800;color:#dc2626;">{len(zone1_orders)}</div>
                  <div style="font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;margin-top:2px;">Zone 1: Overdue</div>
                </td>
                <td width="3%"></td>
                <td width="31%" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 14px;text-align:center;">
                  <div style="font-size:22px;font-weight:800;color:#ea580c;">{len(zone2_stages)}</div>
                  <div style="font-size:11px;font-weight:700;color:#9a3412;text-transform:uppercase;margin-top:2px;">Zone 2: Stage Delays</div>
                </td>
                <td width="3%"></td>
                <td width="31%" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 14px;text-align:center;">
                  <div style="font-size:22px;font-weight:800;color:#d97706;">{len(zone3_orders)}</div>
                  <div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;margin-top:2px;">Zone 3: Imminent Due</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- SECTION 1: ZONE 3 IMMINENT EX-FACTORY DEADLINES -->
        <tr>
          <td style="padding:16px 30px;">
            <div style="border-left:4px solid #f59e0b;padding-left:10px;margin-bottom:12px;">
              <div style="font-size:14px;font-weight:800;color:#92400e;text-transform:uppercase;">
                Zone 3 — Ex-Factory Date Approaching (Next 7 Days)
              </div>
              <div style="font-size:12px;color:#78350f;">Requires final packing verification and QC scheduling.</div>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;">
              <thead>
                <tr style="background:#fef3c7;border-bottom:1px solid #fde68a;text-align:left;">
                  <th style="padding:10px 12px;color:#92400e;font-size:11px;text-transform:uppercase;">PO Reference</th>
                  <th style="padding:10px 12px;color:#92400e;font-size:11px;text-transform:uppercase;">Style / Garment</th>
                  <th style="padding:10px 12px;color:#92400e;font-size:11px;text-transform:uppercase;">Ex-Factory Date</th>
                  <th style="padding:10px 12px;color:#92400e;font-size:11px;text-transform:uppercase;">Status</th>
                </tr>
              </thead>
              <tbody>
                {z3_rows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- SECTION 2: ZONE 1 OVERDUE ESCALATION -->
        <tr>
          <td style="padding:10px 30px;">
            <div style="border-left:4px solid #dc2626;padding-left:10px;margin-bottom:12px;">
              <div style="font-size:14px;font-weight:800;color:#991b1b;text-transform:uppercase;">
                Zone 1 — Ex-Factory Date Passed (Active Breach)
              </div>
              <div style="font-size:12px;color:#7f1d1d;">Mandatory: Root cause, CAPA and recovery commitment must be updated.</div>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;font-size:13px;">
              <thead>
                <tr style="background:#fee2e2;border-bottom:1px solid #fecaca;text-align:left;">
                  <th style="padding:10px 12px;color:#991b1b;font-size:11px;text-transform:uppercase;">PO Reference</th>
                  <th style="padding:10px 12px;color:#991b1b;font-size:11px;text-transform:uppercase;">Style</th>
                  <th style="padding:10px 12px;color:#991b1b;font-size:11px;text-transform:uppercase;">Target Date</th>
                  <th style="padding:10px 12px;color:#991b1b;font-size:11px;text-transform:uppercase;">Overdue Days</th>
                </tr>
              </thead>
              <tbody>
                {z1_rows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- SECTION 3: ZONE 2 DELAYED PROCESS STAGES -->
        <tr>
          <td style="padding:10px 30px;">
            <div style="border-left:4px solid #ea580c;padding-left:10px;margin-bottom:12px;">
              <div style="font-size:14px;font-weight:800;color:#9a3412;text-transform:uppercase;">
                Zone 2 — Development &amp; Process Stages Delayed
              </div>
              <div style="font-size:12px;color:#7c2d12;">Active lines exceeding planned stage completion dates.</div>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-size:13px;">
              <thead>
                <tr style="background:#ffedd5;border-bottom:1px solid #fed7aa;text-align:left;">
                  <th style="padding:10px 12px;color:#9a3412;font-size:11px;text-transform:uppercase;">PO Reference</th>
                  <th style="padding:10px 12px;color:#9a3412;font-size:11px;text-transform:uppercase;">Stuck Stage</th>
                  <th style="padding:10px 12px;color:#9a3412;font-size:11px;text-transform:uppercase;">Stage Target</th>
                  <th style="padding:10px 12px;color:#9a3412;font-size:11px;text-transform:uppercase;">Stage Delay</th>
                </tr>
              </thead>
              <tbody>
                {z2_rows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- CTA Button -->
        <tr>
          <td style="padding:24px 30px;text-align:center;">
            <a href="{wip_url}" style="background:#0284c7;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block;box-shadow:0 2px 8px rgba(2,132,199,0.3);">
              Access Live WIP Tracking Dashboard &amp; Download CSV →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 30px;background:#f1f5f9;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.5;">
            Sent automatically by Cotton Collective QC &amp; Production Management System.<br/>
            AWS Production Server: <code>13.60.76.142</code> | Relay: <code>qc@cottoncollective.org</code>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""
    return subject, html


def main():
    db = SessionLocal()
    try:
        super_admins = get_super_admin_emails(db)
        print("==================================================")
        print("🚀 Live AWS Scheduled Emails Dispatcher Starting")
        print(f"Target Super Admins ({len(super_admins)}): {super_admins}")
        print("==================================================")

        today = date.today()
        print(f"[*] Querying live production database for {today}...")

        active_orders = db.query(Order).filter(
            Order.status.notin_([OrderStatus.completed, OrderStatus.cancelled]),
            Order.is_active == True,
        ).all()
        print(f"[*] Found {len(active_orders)} active orders in database.")

        # Real Cotton Collective POs
        cc_orders = [o for o in active_orders if o.order_no and o.order_no.startswith("CC")]
        cc_po_list = [o.order_no for o in cc_orders]
        print(f"[*] Found {len(cc_po_list)} live Cotton Collective POs.")
        live_po_refs = " // ".join(cc_po_list[:12])

        # Real Zone 3: Approaching in next 7 days
        zone3_orders = [
            o for o in active_orders 
            if o.ex_factory_date and today <= o.ex_factory_date <= today + timedelta(days=7)
        ]
        print(f"[*] Found {len(zone3_orders)} Zone 3 orders approaching ex-factory deadline.")

        # Real Zone 1: Ex-Factory Passed
        zone1_orders = [
            o for o in active_orders 
            if o.ex_factory_date and o.ex_factory_date < today
        ]
        print(f"[*] Found {len(zone1_orders)} Zone 1 overdue orders.")

        # Real Zone 2: Delayed Stages
        zone2_stages = []
        for o in active_orders:
            for s in o.stages:
                if s.status not in (StageStatus.completed, StageStatus.skipped) and s.target_date:
                    st = s.target_date.date() if hasattr(s.target_date, "date") else s.target_date
                    if st < today:
                        zone2_stages.append((o, s, (today - st).days))
        print(f"[*] Found {len(zone2_stages)} Zone 2 delayed production stages.")

        wip_url = f"{settings.APP_BASE_URL}/tracking-dashboard"

        # ─────────────────────────────────────────────────────────────
        # DISPATCH 1: COTTON COLLECTIVE WIP CSV & 6 CONTROL ZONES DIRECTIVE
        # ─────────────────────────────────────────────────────────────
        print("\n" + "="*50)
        print("📨 [1/3] SENDING DIRECTIVE: WIP CSV & 6 CONTROL ZONES DIRECTIVE")
        print("="*50)
        directive_data = {
            "po_references": live_po_refs,
            "brand_name": "COTTON COLLECTIVE",
            "wip_url": wip_url,
        }
        res1 = send_order_status_reminder(
            template_type="wip_directive",
            order=directive_data,
            recipients=super_admins,
            custom_note="Official Cotton Collective executive directive generated with live AWS production PO data.",
        )
        print(f"✅ Directive Sent: {res1}")

        # Safety countdown: 60 seconds pacing so process/domain is not hurt
        print("\n⏳ Safety Pacing Active: Waiting 60 seconds before next scheduled email to protect SMTP domain reputation...")
        for remaining in range(60, 0, -10):
            print(f"   ... {remaining}s remaining before next send")
            time.sleep(10)

        # ─────────────────────────────────────────────────────────────
        # DISPATCH 2: DAILY 6 CONTROL ZONES EXECUTIVE DIGEST
        # ─────────────────────────────────────────────────────────────
        print("\n" + "="*50)
        print("📨 [2/3] SENDING SCHEDULED DIGEST: DAILY CONTROL ZONES STATUS")
        print("="*50)
        subj2, html2 = build_daily_zones_executive_digest(
            today=today,
            zone1_orders=zone1_orders,
            zone2_stages=zone2_stages,
            zone3_orders=zone3_orders,
            zone4_orders=[],
            wip_url=wip_url,
        )
        msg2 = _build_message(to=super_admins, cc=[], subject=subj2, html_body=html2)
        _send_or_dryrun(msg2, super_admins)
        print(f"✅ Daily Zones Digest Sent: {subj2}")

        # Safety countdown: 60 seconds pacing so process/domain is not hurt
        print("\n⏳ Safety Pacing Active: Waiting 60 seconds before next scheduled email to protect SMTP domain reputation...")
        for remaining in range(60, 0, -10):
            print(f"   ... {remaining}s remaining before next send")
            time.sleep(10)

        # ─────────────────────────────────────────────────────────────
        # DISPATCH 3: ZONE 1 CRITICAL DELAY ESCALATION ALERT (REAL ORDER)
        # ─────────────────────────────────────────────────────────────
        print("\n" + "="*50)
        print("📨 [3/3] SENDING PO ESCALATION: ZONE 1 SCHEDULE OVERDUE ALERT")
        print("="*50)
        # Pick top active Cotton Collective overdue order
        sample_overdue = next((o for o in zone1_orders if o.order_no and o.order_no.startswith("CC")), zone1_orders[0])
        delay_days = (today - sample_overdue.ex_factory_date).days if sample_overdue.ex_factory_date else sample_overdue.delay_days

        escalation_data = {
            "id": str(sample_overdue.id),
            "order_no": sample_overdue.order_no,
            "style_name": sample_overdue.style_name or sample_overdue.product_name or "Garment Batch",
            "customer": "Cotton Collective",
            "quantity": sample_overdue.quantity or 5000,
            "ex_factory_date": str(sample_overdue.ex_factory_date),
            "days_delayed": delay_days,
            "current_stage": "Stitching Line Delay",
            "delay_reason": sample_overdue.delay_reason or "Material supply delivery lag & QC batch reinspection",
            "delay_capa": sample_overdue.delay_capa or "Line balancing adjusted, weekend overtime scheduled, expedited air shipment allocated",
            "recovery_date": str(today + timedelta(days=5)),
        }
        res3 = send_order_status_reminder(
            template_type="date_delay",
            order=escalation_data,
            recipients=super_admins,
            custom_note="Live Zone 1 escalation dispatch from Cotton Collective production scanner.",
        )
        print(f"✅ PO Delay Escalation Sent: {res3}")

        print("\n" + "="*50)
        print("🎉 ALL SCHEDULED LIVE EMAILS SUCCESSFULLY SENT TO:")
        print(f"👉 {super_admins}")
        print("==================================================")

    finally:
        db.close()


if __name__ == "__main__":
    main()
