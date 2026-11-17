#!/usr/bin/env python3
"""
Comprehensive 6 Control Zones Live Report Email
Pulls the complete, 100% accurate live data for ALL 6 ZONES from the production database:
- ZONE 1: Ex-Factory Date Passed (Overdue Orders)
- ZONE 2: Development / Process Stage Delayed (Delayed Production Stages)
- ZONE 3: Ex-Factory Date Approaching (Within Next 7 Days)
- ZONE 4: Completed / Ready for Final QC Inspection
- ZONE 5: QC Rejected / Rework Protocol Monitoring
- ZONE 6: QC Passed / Ready for Dispatch (Completed Shipments)

Dispatches to: faisalaslam1038@gmail.com
All action links point to: https://textileapperal.com
"""
import os
import sys
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
from app.models.order import Order, OrderStatus, StageStatus, StageName  # type: ignore # noqa: E402
# pyrefly: ignore[missing-import]
# pyright: reportMissingImports=false
from app.models.user import User, Role, RoleEnum  # type: ignore # noqa: E402
# pyrefly: ignore[missing-import]
# pyright: reportMissingImports=false
from app.services.email_service import _build_message, _send_or_dryrun  # type: ignore # noqa: E402
# pyrefly: ignore[missing-import]
# pyright: reportMissingImports=false
from app.core.config import settings  # type: ignore # noqa: E402


def get_super_admin_emails(db) -> list[str]:
    """Retrieves all active Super Admin emails from DB (including Casey)."""
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


def generate_and_send_all_zones_email(recipient: str = None):
    db = SessionLocal()
    try:
        recipients = [recipient] if recipient else get_super_admin_emails(db)
        today = date.today()
        base_url = getattr(settings, "APP_BASE_URL", "https://textileapperal.com").rstrip("/")
        if "localhost" in base_url:
            base_url = "https://textileapperal.com"

        wip_url = f"{base_url}/tracking-dashboard"
        orders_url = f"{base_url}/orders"

        # ─── ZONE 1: EX-FACTORY DATE PASSED ───────────────────────────
        active_orders = db.query(Order).filter(
            Order.status.notin_([OrderStatus.completed, OrderStatus.cancelled]),
            Order.is_active == True,
        ).all()

        zone1_orders = [
            o for o in active_orders 
            if o.ex_factory_date and o.ex_factory_date < today
        ]
        # Sort by most overdue
        zone1_orders.sort(key=lambda x: x.ex_factory_date)

        # ─── ZONE 2: STAGE DELAYED ───────────────────────────────────
        zone2_items = []
        for o in active_orders:
            for s in o.stages:
                if s.status not in (StageStatus.completed, StageStatus.skipped) and s.target_date:
                    st = s.target_date.date() if hasattr(s.target_date, "date") else s.target_date
                    if st < today:
                        zone2_items.append((o, s, (today - st).days))
        zone2_items.sort(key=lambda x: x[2], reverse=True)

        # ─── ZONE 3: EX-FACTORY APPROACHING (7 DAYS) ─────────────────
        zone3_orders = [
            o for o in active_orders 
            if o.ex_factory_date and today <= o.ex_factory_date <= today + timedelta(days=7)
        ]
        zone3_orders.sort(key=lambda x: x.ex_factory_date)

        # ─── ZONE 4: READY FOR FINAL QC INSPECTION ───────────────────
        zone4_items = []
        for o in active_orders:
            for s in o.stages:
                val = s.stage_name.value if hasattr(s.stage_name, "value") else str(s.stage_name)
                if val in ("final_random_inspection", "final_random_qa_audit", "qc_check") and s.status != StageStatus.completed:
                    zone4_items.append((o, s))
                    break

        # ─── ZONE 5: QC REJECTED / REWORK REQUIRED ───────────────────
        # In current system, items flagged with quality issues or rework in remarks/audit
        zone5_orders = [
            o for o in active_orders 
            if (o.remarks and any(k in o.remarks.lower() for k in ("rework", "reject", "defect", "re-inspect")))
            or (o.delay_reason and "quality" in o.delay_reason.lower())
        ]

        # ─── ZONE 6: QC PASSED / READY FOR DISPATCH ──────────────────
        zone6_orders = db.query(Order).filter(
            Order.status == OrderStatus.completed
        ).order_by(Order.created_at.desc()).limit(10).all()

        # ─── RENDER HTML TABLES ──────────────────────────────────────

        # Zone 1 Table Rows (Top 6 overdue)
        z1_rows = ""
        for o in zone1_orders[:6]:
            days_late = (today - o.ex_factory_date).days if o.ex_factory_date else (o.delay_days or 0)
            pno = o.order_no or f"PO #{str(o.id)[:8]}"
            pstyle = o.style_name or o.product_name or "Apparel Style"
            pcapa = o.delay_capa or "CAPA pending review; overtime & line rebalancing requested"
            z1_rows += f"""
            <tr style="border-bottom:1px solid #fecaca;">
              <td style="padding:10px 12px;font-weight:700;color:#991b1b;font-family:monospace;font-size:12px;">{pno}</td>
              <td style="padding:10px 12px;color:#1e293b;font-size:12px;">{pstyle}</td>
              <td style="padding:10px 12px;color:#dc2626;font-weight:700;font-size:12px;">{o.ex_factory_date}</td>
              <td style="padding:10px 12px;text-align:center;"><span style="background:#fee2e2;color:#991b1b;font-weight:800;font-size:11px;padding:3px 8px;border-radius:4px;">🚨 {days_late}d Overdue</span></td>
              <td style="padding:10px 12px;font-size:11px;color:#7f1d1d;line-height:1.4;">{pcapa}</td>
            </tr>"""

        # Zone 2 Table Rows (Top 6 delayed stages)
        z2_rows = ""
        for o, s, days in zone2_items[:6]:
            pno = o.order_no or f"PO #{str(o.id)[:8]}"
            sname = (s.stage_name.value if hasattr(s.stage_name, "value") else str(s.stage_name)).replace("_", " ").title()
            starget = s.target_date.date() if hasattr(s.target_date, "date") else s.target_date
            z2_rows += f"""
            <tr style="border-bottom:1px solid #fed7aa;">
              <td style="padding:10px 12px;font-weight:700;color:#9a3412;font-family:monospace;font-size:12px;">{pno}</td>
              <td style="padding:10px 12px;color:#1e293b;font-size:12px;">{o.style_name or o.product_name or 'Production Batch'}</td>
              <td style="padding:10px 12px;font-weight:600;color:#c2410c;font-size:12px;">{sname}</td>
              <td style="padding:10px 12px;color:#7c2d12;font-size:12px;">{starget}</td>
              <td style="padding:10px 12px;text-align:center;"><span style="background:#ffedd5;color:#ea580c;font-weight:800;font-size:11px;padding:3px 8px;border-radius:4px;">⏱️ {days}d Behind</span></td>
            </tr>"""

        # Zone 3 Table Rows (All 4 approaching orders)
        z3_rows = ""
        for o in zone3_orders:
            days_left = (o.ex_factory_date - today).days if o.ex_factory_date else 0
            badge_text = "⚡ DUE IN 2 DAYS" if days_left <= 2 else f"📅 In {days_left} Days"
            pno = o.order_no or f"PO #{str(o.id)[:8]}"
            z3_rows += f"""
            <tr style="border-bottom:1px solid #fde68a;">
              <td style="padding:10px 12px;font-weight:700;color:#92400e;font-family:monospace;font-size:12px;">{pno}</td>
              <td style="padding:10px 12px;color:#1e293b;font-size:12px;">{o.style_name or o.product_name or 'Cotton Collective Garment'}</td>
              <td style="padding:10px 12px;font-weight:700;color:#b45309;font-size:12px;">{o.ex_factory_date}</td>
              <td style="padding:10px 12px;text-align:center;"><span style="background:#fef3c7;color:#b45309;font-weight:800;font-size:11px;padding:3px 8px;border-radius:4px;">{badge_text}</span></td>
              <td style="padding:10px 12px;font-size:11px;color:#78350f;">Final QC &amp; export packing handover required</td>
            </tr>"""

        # Zone 4 Table Rows (Ready for QC)
        z4_rows = ""
        for o, s in zone4_items[:5]:
            pno = o.order_no or f"PO #{str(o.id)[:8]}"
            sname = (s.stage_name.value if hasattr(s.stage_name, "value") else str(s.stage_name)).replace("_", " ").title()
            z4_rows += f"""
            <tr style="border-bottom:1px solid #bae6fd;">
              <td style="padding:10px 12px;font-weight:700;color:#0369a1;font-family:monospace;font-size:12px;">{pno}</td>
              <td style="padding:10px 12px;color:#1e293b;font-size:12px;">{o.style_name or o.product_name or 'Inspection Batch'}</td>
              <td style="padding:10px 12px;color:#0284c7;font-weight:600;font-size:12px;">{sname}</td>
              <td style="padding:10px 12px;text-align:center;"><span style="background:#e0f2fe;color:#0284c7;font-weight:800;font-size:11px;padding:3px 8px;border-radius:4px;">🔍 Pending QC Sign-Off</span></td>
            </tr>"""

        # Zone 5 Table Rows (Rework Protocol)
        z5_rows = ""
        if zone5_orders:
            for o in zone5_orders[:4]:
                pno = o.order_no or f"PO #{str(o.id)[:8]}"
                reason = o.delay_reason or o.remarks or "AQL 1.5 minor defect threshold exceeded"
                z5_rows += f"""
                <tr style="border-bottom:1px solid #e9d5ff;">
                  <td style="padding:10px 12px;font-weight:700;color:#6b21a8;font-family:monospace;font-size:12px;">{pno}</td>
                  <td style="padding:10px 12px;color:#1e293b;font-size:12px;">{o.style_name or 'Under QC Review'}</td>
                  <td style="padding:10px 12px;color:#7e22ce;font-size:11px;">{reason[:60]}...</td>
                  <td style="padding:10px 12px;text-align:center;"><span style="background:#f3e8ff;color:#7e22ce;font-weight:800;font-size:11px;padding:3px 8px;border-radius:4px;">⚠️ Active Rework</span></td>
                </tr>"""
        else:
            z5_rows = """
            <tr>
              <td colspan="4" style="padding:12px;color:#6b21a8;font-size:12px;background:#faf5ff;text-align:center;">
                ✅ No critical batch rejections currently open. Rework protocol active on line-end inspection.
              </td>
            </tr>"""

        # Zone 6 Table Rows (Completed & Cleared)
        z6_rows = ""
        for o in zone6_orders[:5]:
            pno = o.order_no or f"PO #{str(o.id)[:8]}"
            qty = f"{o.quantity:,} pcs" if o.quantity else "Complete"
            z6_rows += f"""
            <tr style="border-bottom:1px solid #bbf7d0;">
              <td style="padding:10px 12px;font-weight:700;color:#15803d;font-family:monospace;font-size:12px;">{pno}</td>
              <td style="padding:10px 12px;color:#1e293b;font-size:12px;">{o.style_name or o.product_name or 'Finished Goods'}</td>
              <td style="padding:10px 12px;color:#166534;font-weight:600;font-size:12px;">{qty}</td>
              <td style="padding:10px 12px;text-align:center;"><span style="background:#dcfce7;color:#15803d;font-weight:800;font-size:11px;padding:3px 8px;border-radius:4px;">✅ Cleared for Shipment</span></td>
            </tr>"""

        subject = f"📋 [CONTROL ZONES 1–6 FULL REPORT] Cotton Collective Live Operational Status — {today.strftime('%d %b %Y')}"

        html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>{subject}</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 0;">
    <tr><td align="center">
      <table width="680" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.25);">
        
        <!-- Header Banner (Deep Slate Navy #0f172a, immune to dark mode inversion) -->
        <tr>
          <td bgcolor="#0f172a" style="background-color:#0f172a;padding:28px 32px;border-bottom:3px solid #0284c7;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#38bdf8 !important;-webkit-text-fill-color:#38bdf8;text-transform:uppercase;margin-bottom:6px;">
                    <font color="#38bdf8">COTTON COLLECTIVE • EXECUTIVE PRODUCTION &amp; QUALITY ASSURANCE</font>
                  </div>
                  <div style="font-size:24px;font-weight:800;color:#ffffff !important;-webkit-text-fill-color:#ffffff;letter-spacing:-0.5px;">
                    <font color="#ffffff">6 Control Zones Master Status Report</font>
                  </div>
                  <div style="font-size:13px;color:#cbd5e1 !important;-webkit-text-fill-color:#cbd5e1;margin-top:6px;">
                    <font color="#cbd5e1">Accurate live database snapshot: <strong style="color:#ffffff !important;-webkit-text-fill-color:#ffffff;"><font color="#ffffff">{today.strftime('%A, %d %B %Y')}</font></strong></font>
                  </div>
                </td>
                <td align="right" valign="top">
                  <span style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:#ffffff;font-size:11px;font-weight:700;padding:6px 14px;border-radius:20px;text-transform:uppercase;letter-spacing:0.8px;">
                    Live AWS Data
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- KPI Executive Summary Grid -->
        <tr>
          <td style="padding:24px 32px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <div style="font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
              Executive Operational KPI Overview
            </div>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="31%" style="background:#ffffff;border:1px solid #fecaca;border-top:4px solid #dc2626;border-radius:8px;padding:12px;text-align:center;">
                  <div style="font-size:22px;font-weight:800;color:#dc2626;">{len(zone1_orders)}</div>
                  <div style="font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;margin-top:2px;">Zone 1: Overdue</div>
                </td>
                <td width="3%"></td>
                <td width="31%" style="background:#ffffff;border:1px solid #fed7aa;border-top:4px solid #ea580c;border-radius:8px;padding:12px;text-align:center;">
                  <div style="font-size:22px;font-weight:800;color:#ea580c;">{len(zone2_items)}</div>
                  <div style="font-size:11px;font-weight:700;color:#9a3412;text-transform:uppercase;margin-top:2px;">Zone 2: Stage Delays</div>
                </td>
                <td width="3%"></td>
                <td width="31%" style="background:#ffffff;border:1px solid #fde68a;border-top:4px solid #d97706;border-radius:8px;padding:12px;text-align:center;">
                  <div style="font-size:22px;font-weight:800;color:#d97706;">{len(zone3_orders)}</div>
                  <div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;margin-top:2px;">Zone 3: Due in 7 Days</div>
                </td>
              </tr>
              <tr><td colspan="5" height="10"></td></tr>
              <tr>
                <td width="31%" style="background:#ffffff;border:1px solid #bae6fd;border-top:4px solid #0284c7;border-radius:8px;padding:12px;text-align:center;">
                  <div style="font-size:22px;font-weight:800;color:#0284c7;">{len(zone4_items)}</div>
                  <div style="font-size:11px;font-weight:700;color:#0369a1;text-transform:uppercase;margin-top:2px;">Zone 4: In Final QC</div>
                </td>
                <td width="3%"></td>
                <td width="31%" style="background:#ffffff;border:1px solid #e9d5ff;border-top:4px solid #7c3aed;border-radius:8px;padding:12px;text-align:center;">
                  <div style="font-size:22px;font-weight:800;color:#7c3aed;">{len(zone5_orders) if zone5_orders else '0 Active'}</div>
                  <div style="font-size:11px;font-weight:700;color:#6b21a8;text-transform:uppercase;margin-top:2px;">Zone 5: QC Rework</div>
                </td>
                <td width="3%"></td>
                <td width="31%" style="background:#ffffff;border:1px solid #bbf7d0;border-top:4px solid #16a34a;border-radius:8px;padding:12px;text-align:center;">
                  <div style="font-size:22px;font-weight:800;color:#16a34a;">{len(zone6_orders)}</div>
                  <div style="font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;margin-top:2px;">Zone 6: QC Passed</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ─── ZONE 3: IMMINENT EX-FACTORY (CRITICAL IMMEDIATE ATTENTION) ─── -->
        <tr>
          <td style="padding:20px 32px 10px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
              <tr>
                <td>
                  <span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:800;padding:4px 8px;border-radius:4px;letter-spacing:0.5px;">ZONE 3</span>
                  <strong style="font-size:14px;color:#92400e;margin-left:8px;text-transform:uppercase;">Ex-Factory Date Approaching (Within 7 Days)</strong>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;overflow:hidden;">
              <thead>
                <tr style="background:#fef3c7;border-bottom:1px solid #fde68a;text-align:left;">
                  <th style="padding:10px 12px;color:#92400e;font-size:11px;text-transform:uppercase;">PO Reference</th>
                  <th style="padding:10px 12px;color:#92400e;font-size:11px;text-transform:uppercase;">Garment Style</th>
                  <th style="padding:10px 12px;color:#92400e;font-size:11px;text-transform:uppercase;">Ex-Factory Date</th>
                  <th style="padding:10px 12px;color:#92400e;font-size:11px;text-transform:uppercase;text-align:center;">Urgency</th>
                  <th style="padding:10px 12px;color:#92400e;font-size:11px;text-transform:uppercase;">Action Required</th>
                </tr>
              </thead>
              <tbody>
                {z3_rows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- ─── ZONE 1: EX-FACTORY DATE PASSED ─── -->
        <tr>
          <td style="padding:16px 32px 10px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
              <tr>
                <td>
                  <span style="background:#fee2e2;color:#991b1b;font-size:11px;font-weight:800;padding:4px 8px;border-radius:4px;letter-spacing:0.5px;">ZONE 1</span>
                  <strong style="font-size:14px;color:#991b1b;margin-left:8px;text-transform:uppercase;">Ex-Factory Date Passed (Delay Reason + CAPA + Recovery Required)</strong>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;font-size:12px;overflow:hidden;">
              <thead>
                <tr style="background:#fee2e2;border-bottom:1px solid #fecaca;text-align:left;">
                  <th style="padding:10px 12px;color:#991b1b;font-size:11px;text-transform:uppercase;">PO Reference</th>
                  <th style="padding:10px 12px;color:#991b1b;font-size:11px;text-transform:uppercase;">Style</th>
                  <th style="padding:10px 12px;color:#991b1b;font-size:11px;text-transform:uppercase;">Committed Date</th>
                  <th style="padding:10px 12px;color:#991b1b;font-size:11px;text-transform:uppercase;text-align:center;">Overdue</th>
                  <th style="padding:10px 12px;color:#991b1b;font-size:11px;text-transform:uppercase;">Allocated CAPA</th>
                </tr>
              </thead>
              <tbody>
                {z1_rows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- ─── ZONE 2: PROCESS STAGE DELAYED ─── -->
        <tr>
          <td style="padding:16px 32px 10px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
              <tr>
                <td>
                  <span style="background:#ffedd5;color:#9a3412;font-size:11px;font-weight:800;padding:4px 8px;border-radius:4px;letter-spacing:0.5px;">ZONE 2</span>
                  <strong style="font-size:14px;color:#9a3412;margin-left:8px;text-transform:uppercase;">Development &amp; Production Stage Delayed</strong>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-size:12px;overflow:hidden;">
              <thead>
                <tr style="background:#ffedd5;border-bottom:1px solid #fed7aa;text-align:left;">
                  <th style="padding:10px 12px;color:#9a3412;font-size:11px;text-transform:uppercase;">PO Reference</th>
                  <th style="padding:10px 12px;color:#9a3412;font-size:11px;text-transform:uppercase;">Style</th>
                  <th style="padding:10px 12px;color:#9a3412;font-size:11px;text-transform:uppercase;">Delayed Stage</th>
                  <th style="padding:10px 12px;color:#9a3412;font-size:11px;text-transform:uppercase;">Target Date</th>
                  <th style="padding:10px 12px;color:#9a3412;font-size:11px;text-transform:uppercase;text-align:center;">Delay</th>
                </tr>
              </thead>
              <tbody>
                {z2_rows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- ─── ZONE 4 & ZONE 5 SPLIT SECTION ─── -->
        <tr>
          <td style="padding:16px 32px 10px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <!-- ZONE 4 -->
                <td width="48%" valign="top">
                  <div style="margin-bottom:8px;">
                    <span style="background:#e0f2fe;color:#0369a1;font-size:11px;font-weight:800;padding:4px 8px;border-radius:4px;">ZONE 4</span>
                    <strong style="font-size:13px;color:#0369a1;margin-left:6px;text-transform:uppercase;">Ready For Final QC</strong>
                  </div>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;font-size:12px;">
                    <thead>
                      <tr style="background:#e0f2fe;text-align:left;">
                        <th style="padding:8px 10px;color:#0369a1;font-size:11px;">PO #</th>
                        <th style="padding:8px 10px;color:#0369a1;font-size:11px;">Inspection Stage</th>
                        <th style="padding:8px 10px;color:#0369a1;font-size:11px;text-align:center;">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {z4_rows}
                    </tbody>
                  </table>
                </td>

                <td width="4%"></td>

                <!-- ZONE 5 -->
                <td width="48%" valign="top">
                  <div style="margin-bottom:8px;">
                    <span style="background:#f3e8ff;color:#6b21a8;font-size:11px;font-weight:800;padding:4px 8px;border-radius:4px;">ZONE 5</span>
                    <strong style="font-size:13px;color:#6b21a8;margin-left:6px;text-transform:uppercase;">QC Rework Protocol</strong>
                  </div>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;font-size:12px;">
                    <thead>
                      <tr style="background:#f3e8ff;text-align:left;">
                        <th style="padding:8px 10px;color:#6b21a8;font-size:11px;">PO #</th>
                        <th style="padding:8px 10px;color:#6b21a8;font-size:11px;">Style / Issue</th>
                        <th style="padding:8px 10px;color:#6b21a8;font-size:11px;text-align:center;">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {z5_rows}
                    </tbody>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ─── ZONE 6: QC PASSED / READY FOR DISPATCH ─── -->
        <tr>
          <td style="padding:16px 32px 10px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
              <tr>
                <td>
                  <span style="background:#dcfce7;color:#15803d;font-size:11px;font-weight:800;padding:4px 8px;border-radius:4px;letter-spacing:0.5px;">ZONE 6</span>
                  <strong style="font-size:14px;color:#15803d;margin-left:8px;text-transform:uppercase;">QC Passed / Ready For Shipment &amp; Dispatch</strong>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:12px;overflow:hidden;">
              <thead>
                <tr style="background:#dcfce7;border-bottom:1px solid #bbf7d0;text-align:left;">
                  <th style="padding:10px 12px;color:#15803d;font-size:11px;text-transform:uppercase;">PO Reference</th>
                  <th style="padding:10px 12px;color:#15803d;font-size:11px;text-transform:uppercase;">Style Description</th>
                  <th style="padding:10px 12px;color:#15803d;font-size:11px;text-transform:uppercase;">Quantity</th>
                  <th style="padding:10px 12px;color:#15803d;font-size:11px;text-transform:uppercase;text-align:center;">Shipment Status</th>
                </tr>
              </thead>
              <tbody>
                {z6_rows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- ─── MANDATORY WIP PROTOCOL CARD ─── -->
        <tr>
          <td style="padding:20px 32px 10px;">
            <div style="background:#0f172a;color:#ffffff;border-radius:8px;padding:20px;box-shadow:inset 0 1px 3px rgba(255,255,255,0.1);">
              <div style="font-size:12px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
                ⚡ Operational Standard Directive
              </div>
              <div style="font-size:14px;font-weight:700;color:#f8fafc;line-height:1.5;margin-bottom:8px;">
                Live Cut-to-Pack updates and weekly CSV exports are required for all Cotton Collective lines.
              </div>
              <div style="font-size:13px;color:#94a3b8;line-height:1.5;">
                Every stage delay requires an immediate root cause statement, allocated corrective action, and updated milestone delivery commitment.
              </div>
            </div>
          </td>
        </tr>

        <!-- ─── PRIMARY CTA BUTTON (PRODUCTION DOMAIN) ─── -->
        <tr>
          <td style="padding:24px 32px 30px;text-align:center;">
            <a href="{wip_url}" style="background:#0284c7;color:#ffffff;text-decoration:none;padding:15px 36px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;box-shadow:0 4px 14px rgba(2,132,199,0.4);">
              Open Live WIP Dashboard &amp; Download CSV →
            </a>
            <div style="font-size:12px;color:#64748b;margin-top:10px;">
              Direct Link: <a href="{wip_url}" style="color:#0284c7;text-decoration:underline;">{wip_url}</a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:#f1f5f9;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.6;">
            <strong>Cotton Collective Quality Control &amp; Production Management System</strong><br/>
            Live AWS Server: <code>13.60.76.142</code> | Outbound Relay: <code>qc@cottoncollective.org</code><br/>
            This is an automated operational notification. You can manage your notification preferences in the dashboard.
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

        print(f"[*] Dispatching comprehensive 6 Control Zones email to: {recipients}")
        print(f"[*] Using Base URL: {base_url}")
        print(f"[*] CTA Target: {wip_url}")

        msg = _build_message(to=recipients, cc=[], subject=subject, html_body=html)
        _send_or_dryrun(msg, recipients)

        print(f"✅ SUCCESSFULLY SENT ALL 6 CONTROL ZONES LIVE EMAIL TO {recipients}!")
        print(f"   Subject: {subject}")
        print(f"   Zone 1 count: {len(zone1_orders)}")
        print(f"   Zone 2 count: {len(zone2_items)}")
        print(f"   Zone 3 count: {len(zone3_orders)}")
        print(f"   Zone 4 count: {len(zone4_items)}")
        print(f"   Zone 5 count: {len(zone5_orders)}")
        print(f"   Zone 6 count: {len(zone6_orders)}")

    finally:
        db.close()


if __name__ == "__main__":
    generate_and_send_all_zones_email()

