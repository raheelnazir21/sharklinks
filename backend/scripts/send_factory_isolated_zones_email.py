#!/usr/bin/env python3
"""
Factory-Isolated 6 Control Zones Email & Excel Dispatcher
- Features dark and light mode responsive email UI/UX
- Strictly isolates data per factory (only that factory's POs included)
- Automatically CCs all Super Admins (including Faisal Aslam)
- Attaches the factory-specific multi-tab Excel workbook with direct email links
- Paces sends with 60-second delay between factories to protect domain reputation
"""
import os
import sys
import time
import argparse
from datetime import date, timedelta
from typing import List, Dict

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.join(os.path.dirname(current_dir), "backend")
if os.path.exists(backend_path) and backend_path not in sys.path:
    sys.path.insert(0, backend_path)
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from app.core.database import SessionLocal
from app.models.order import Order, OrderStatus, StageStatus
from app.models.user import User, Role, RoleEnum
from app.services.control_zones_excel_builder import (
    build_factory_isolated_6_zones_workbook,
    classify_order_zone,
    ZONE_STYLES,
)
from app.services.email_service import _build_message, _send_or_dryrun
from app.core.config import settings


def get_super_admin_emails(db) -> List[str]:
    super_admins = db.query(User).join(Role).filter(
        Role.name == RoleEnum.super_admin,
        User.is_active == True
    ).all()
    emails = [u.email.strip() for u in super_admins if u.email and "@" in u.email]
    # Guarantee Faisal Aslam and QC Executive Desk are in the CC list
    for p in ["faisalaslam1038@gmail.com", "qc@cottoncollective.org"]:
        if p not in emails:
            emails.append(p)
    return list(dict.fromkeys(emails))


def build_dark_light_responsive_email(
    factory_name: str,
    manager_name: str,
    manager_email: str,
    factory_orders: List[Order],
    super_admin_cc: List[str],
    attachment_filename: str,
    wip_url: str,
    today: date,
) -> tuple[str, str]:
    """
    Renders an executive, dark/light mode responsive HTML email
    strictly showing only this specific factory's metrics and orders.
    """
    zones_map: Dict[int, List[Order]] = {z: [] for z in range(1, 7)}
    for o in factory_orders:
        if o.is_active and o.status != OrderStatus.cancelled:
            z_idx = classify_order_zone(o, today)
            zones_map[z_idx].append(o)

    total_active = sum(len(v) for v in zones_map.values())
    subject = f"📢 [FACTORY DIRECTIVE] Cotton Collective 6 Control Zones Report — {factory_name.upper()} ({today.strftime('%d %b %Y')})"

    # Zone 3 rows (Approaching in 7 days)
    z3_rows = ""
    for o in zones_map[3][:5]:
        days_left = (o.ex_factory_date - today).days if o.ex_factory_date else 0
        urgency = "⚡ Due in 2 Days" if days_left <= 2 else f"📅 In {days_left} Days"
        z3_rows += f"""
        <tr class="table-row">
          <td style="padding:10px 12px;font-weight:700;font-family:monospace;" class="text-amber">{o.order_no or f'PO #{str(o.id)[:8]}'}</td>
          <td style="padding:10px 12px;" class="text-body">{o.style_name or o.product_name or 'Garment Batch'}</td>
          <td style="padding:10px 12px;font-weight:600;" class="text-amber">{o.ex_factory_date}</td>
          <td style="padding:10px 12px;text-align:center;"><span style="background:#fef3c7;color:#b45309;font-weight:800;font-size:11px;padding:3px 8px;border-radius:4px;">{urgency}</span></td>
        </tr>"""
    if not z3_rows:
        z3_rows = '<tr><td colspan="4" style="padding:12px;text-align:center;font-size:12px;" class="text-muted">✅ No imminent deadlines in next 7 days.</td></tr>'

    # Zone 1 rows (Overdue)
    z1_rows = ""
    for o in zones_map[1][:6]:
        days_late = (today - o.ex_factory_date).days if o.ex_factory_date else o.delay_days
        z1_rows += f"""
        <tr class="table-row">
          <td style="padding:10px 12px;font-weight:700;font-family:monospace;" class="text-rose">{o.order_no or f'PO #{str(o.id)[:8]}'}</td>
          <td style="padding:10px 12px;" class="text-body">{o.style_name or o.product_name or 'Garment Batch'}</td>
          <td style="padding:10px 12px;font-weight:600;" class="text-rose">{o.ex_factory_date}</td>
          <td style="padding:10px 12px;text-align:center;"><span style="background:#fee2e2;color:#991b1b;font-weight:800;font-size:11px;padding:3px 8px;border-radius:4px;">🚨 {days_late}d Late</span></td>
          <td style="padding:10px 12px;font-size:11px;" class="text-muted">{o.delay_capa or o.delay_reason or 'CAPA required'}</td>
        </tr>"""
    if not z1_rows:
        z1_rows = '<tr><td colspan="5" style="padding:12px;text-align:center;font-size:12px;" class="text-muted">✅ Zero overdue purchase orders recorded for this facility!</td></tr>'

    # Zone 2 rows (Stage delayed)
    z2_rows = ""
    delayed_stages = []
    for o in factory_orders:
        for s in o.stages:
            if s.status not in (StageStatus.completed, StageStatus.skipped) and s.target_date:
                st = s.target_date.date() if hasattr(s.target_date, "date") else s.target_date
                if st < today:
                    delayed_stages.append((o, s, (today - st).days))
    delayed_stages.sort(key=lambda x: x[2], reverse=True)

    for o, s, days in delayed_stages[:6]:
        sname = (s.stage_name.value if hasattr(s.stage_name, "value") else str(s.stage_name)).replace("_", " ").title()
        z2_rows += f"""
        <tr class="table-row">
          <td style="padding:10px 12px;font-weight:700;font-family:monospace;" class="text-orange">{o.order_no or f'PO #{str(o.id)[:8]}'}</td>
          <td style="padding:10px 12px;" class="text-body">{sname}</td>
          <td style="padding:10px 12px;" class="text-orange">{s.target_date}</td>
          <td style="padding:10px 12px;text-align:center;"><span style="background:#ffedd5;color:#ea580c;font-weight:800;font-size:11px;padding:3px 8px;border-radius:4px;">⏱️ {days}d Behind</span></td>
        </tr>"""
    if not z2_rows:
        z2_rows = '<tr><td colspan="4" style="padding:12px;text-align:center;font-size:12px;" class="text-muted">✅ All active production stages are tracking on schedule.</td></tr>'

    cc_pills = " ".join([f"<span class='cc-pill'>{e}</span>" for e in super_admin_cc])

    html = f"""<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light dark"/>
  <meta name="supported-color-schemes" content="light dark"/>
  <title>{subject}</title>
  <style>
    :root {{
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }}
    /* Light Mode Defaults */
    body, .email-bg {{ background-color: #f1f5f9; color: #1e293b; }}
    .email-card {{ background-color: #ffffff; border: 1px solid #cbd5e1; }}
    .meta-box {{ background-color: #f8fafc; border: 1px solid #e2e8f0; }}
    .kpi-box {{ background-color: #ffffff; border: 1px solid #e2e8f0; }}
    .table-container {{ background-color: #ffffff; border: 1px solid #e2e8f0; }}
    .table-header {{ background-color: #f8fafc; color: #475569; }}
    .table-row {{ border-bottom: 1px solid #f1f5f9; }}
    .text-title {{ color: #0f172a; }}
    .text-body {{ color: #334155; }}
    .text-muted {{ color: #64748b; }}
    .text-rose {{ color: #dc2626; }}
    .text-orange {{ color: #ea580c; }}
    .text-amber {{ color: #d97706; }}
    .text-blue {{ color: #0284c7; }}
    .text-green {{ color: #16a34a; }}
    .cc-pill {{ background: #e2e8f0; color: #334155; font-size: 11px; padding: 2px 8px; border-radius: 12px; display: inline-block; margin: 2px 4px 2px 0; font-family: monospace; }}
    .footer-box {{ background-color: #f8fafc; border-top: 1px solid #e2e8f0; color: #64748b; }}

    /* Dark Mode Overrides */
    @media (prefers-color-scheme: dark) {{
      body, .email-bg {{ background-color: #090d16 !important; color: #f8fafc !important; }}
      .email-card {{ background-color: #111827 !important; border-color: #1f2937 !important; box-shadow: 0 10px 30px rgba(0,0,0,0.6) !important; }}
      .header-cell {{ background-color: #0f172a !important; }}
      .meta-box {{ background-color: #1a2234 !important; border-color: #2d3748 !important; }}
      .kpi-box {{ background-color: #1e293b !important; border-color: #334155 !important; }}
      .table-container {{ background-color: #111827 !important; border-color: #1f2937 !important; }}
      .table-header {{ background-color: #1e293b !important; color: #94a3b8 !important; }}
      .table-row {{ border-bottom: 1px solid #1f2937 !important; }}
      .text-title {{ color: #f8fafc !important; }}
      .text-body {{ color: #e2e8f0 !important; }}
      .text-muted {{ color: #94a3b8 !important; }}
      .text-rose {{ color: #f87171 !important; }}
      .text-orange {{ color: #fb923c !important; }}
      .text-amber {{ color: #fbbf24 !important; }}
      .text-blue {{ color: #38bdf8 !important; }}
      .text-green {{ color: #4ade80 !important; }}
      .cc-pill {{ background: #1f2937 !important; color: #94a3b8 !important; border: 1px solid #374151 !important; }}
      .footer-box {{ background-color: #0f172a !important; border-color: #1e293b !important; color: #94a3b8 !important; }}
    }}

    [data-ogsc] .header-cell {{ background-color: #0f172a !important; }}
    [data-ogsc] .text-title {{ color: #f8fafc !important; }}
    [data-ogsc] .text-body {{ color: #e2e8f0 !important; }}
  </style>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;" class="email-bg">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 0;" class="email-bg">
    <tr><td align="center">
      <table width="680" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.12);" class="email-card">
        
        <!-- Header Banner (Deep Slate Navy #0f172a, immune to Gmail dark mode inversion) -->
        <tr>
          <td bgcolor="#0f172a" class="header-cell" style="background-color:#0f172a;padding:26px 32px;border-bottom:3px solid #0284c7;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#38bdf8 !important;-webkit-text-fill-color:#38bdf8;text-transform:uppercase;margin-bottom:6px;">
                    <font color="#38bdf8">COTTON COLLECTIVE • PRODUCTION &amp; QUALITY DIRECTIVE</font>
                  </div>
                  <div style="font-size:23px;font-weight:800;color:#ffffff !important;-webkit-text-fill-color:#ffffff;letter-spacing:-0.5px;line-height:1.2;">
                    <font color="#ffffff">6 Control Zones Status: {factory_name.upper()}</font>
                  </div>
                  <div style="font-size:13px;color:#cbd5e1 !important;-webkit-text-fill-color:#cbd5e1;margin-top:6px;">
                    <font color="#cbd5e1">Operational Date: <strong style="color:#ffffff !important;-webkit-text-fill-color:#ffffff;"><font color="#ffffff">{today.strftime('%A, %d %B %Y')}</font></strong></font>
                  </div>
                </td>
                <td align="right" valign="top">
                  <span style="background:#1e293b;border:1px solid #334155;color:#38bdf8 !important;-webkit-text-fill-color:#38bdf8;font-size:11px;font-weight:700;padding:6px 14px;border-radius:20px;text-transform:uppercase;letter-spacing:0.8px;display:inline-block;">
                    <font color="#38bdf8">Factory Isolated</font>
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Security & Routing Metadata Card -->
        <tr>
          <td style="padding:20px 32px 10px;">
            <div style="border-radius:8px;padding:16px 20px;" class="meta-box">
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.6;">
                <tr>
                  <td width="22%" style="font-weight:700;" class="text-muted">Target Facility:</td>
                  <td style="font-weight:800;" class="text-title">{factory_name}</td>
                </tr>
                <tr>
                  <td style="font-weight:700;" class="text-muted">Facility Lead:</td>
                  <td class="text-body"><strong>{manager_name}</strong> &lt;{manager_email}&gt;</td>
                </tr>
                <tr>
                  <td style="font-weight:700;vertical-align:top;" class="text-muted">Super Admins CC:</td>
                  <td>{cc_pills}</td>
                </tr>
                <tr>
                  <td style="font-weight:700;" class="text-muted">Data Confidentiality:</td>
                  <td style="color:#059669;font-weight:700;font-size:12px;">🔒 Strictly Isolated (Contains only {factory_name} POs)</td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- 6 Control Zones KPI Grid -->
        <tr>
          <td style="padding:14px 32px 10px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="31%" style="border-radius:8px;padding:12px;text-align:center;border-top:4px solid #dc2626;" class="kpi-box">
                  <div style="font-size:22px;font-weight:800;" class="text-rose">{len(zones_map[1])}</div>
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;margin-top:2px;" class="text-rose">Zone 1: Overdue</div>
                </td>
                <td width="3%"></td>
                <td width="31%" style="border-radius:8px;padding:12px;text-align:center;border-top:4px solid #ea580c;" class="kpi-box">
                  <div style="font-size:22px;font-weight:800;" class="text-orange">{len(delayed_stages)}</div>
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;margin-top:2px;" class="text-orange">Zone 2: Stage Delays</div>
                </td>
                <td width="3%"></td>
                <td width="31%" style="border-radius:8px;padding:12px;text-align:center;border-top:4px solid #d97706;" class="kpi-box">
                  <div style="font-size:22px;font-weight:800;" class="text-amber">{len(zones_map[3])}</div>
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;margin-top:2px;" class="text-amber">Zone 3: Due 7 Days</div>
                </td>
              </tr>
              <tr><td colspan="5" height="10"></td></tr>
              <tr>
                <td width="31%" style="border-radius:8px;padding:12px;text-align:center;border-top:4px solid #0284c7;" class="kpi-box">
                  <div style="font-size:22px;font-weight:800;" class="text-blue">{len(zones_map[4])}</div>
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;margin-top:2px;" class="text-blue">Zone 4: In Final QC</div>
                </td>
                <td width="3%"></td>
                <td width="31%" style="border-radius:8px;padding:12px;text-align:center;border-top:4px solid #7c3aed;" class="kpi-box">
                  <div style="font-size:22px;font-weight:800;" class="text-muted">{len(zones_map[5])} Active</div>
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;margin-top:2px;" class="text-muted">Zone 5: Rework</div>
                </td>
                <td width="3%"></td>
                <td width="31%" style="border-radius:8px;padding:12px;text-align:center;border-top:4px solid #16a34a;" class="kpi-box">
                  <div style="font-size:22px;font-weight:800;" class="text-green">{len(zones_map[6])}</div>
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;margin-top:2px;" class="text-green">Zone 6: Cleared</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ZONE 3: IMMINENT EX-FACTORY DEADLINES -->
        <tr>
          <td style="padding:16px 32px 10px;">
            <div style="margin-bottom:8px;">
              <span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:800;padding:3px 8px;border-radius:4px;">ZONE 3</span>
              <strong style="font-size:13px;margin-left:8px;text-transform:uppercase;" class="text-title">Ex-Factory Date Approaching (Within 7 Days)</strong>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;font-size:12px;overflow:hidden;" class="table-container">
              <thead>
                <tr class="table-header">
                  <th style="padding:10px 12px;text-align:left;">PO Reference</th>
                  <th style="padding:10px 12px;text-align:left;">Garment Style</th>
                  <th style="padding:10px 12px;text-align:left;">Ex-Factory Date</th>
                  <th style="padding:10px 12px;text-align:center;">Urgency Status</th>
                </tr>
              </thead>
              <tbody>
                {z3_rows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- ZONE 1: OVERDUE ACTION REQUIRED -->
        <tr>
          <td style="padding:14px 32px 10px;">
            <div style="margin-bottom:8px;">
              <span style="background:#fee2e2;color:#991b1b;font-size:11px;font-weight:800;padding:3px 8px;border-radius:4px;">ZONE 1</span>
              <strong style="font-size:13px;margin-left:8px;text-transform:uppercase;" class="text-title">Ex-Factory Date Passed (Delay Reason + CAPA Required)</strong>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;font-size:12px;overflow:hidden;" class="table-container">
              <thead>
                <tr class="table-header">
                  <th style="padding:10px 12px;text-align:left;">PO Reference</th>
                  <th style="padding:10px 12px;text-align:left;">Style Description</th>
                  <th style="padding:10px 12px;text-align:left;">Committed Target</th>
                  <th style="padding:10px 12px;text-align:center;">Overdue Metric</th>
                  <th style="padding:10px 12px;text-align:left;">Allocated CAPA</th>
                </tr>
              </thead>
              <tbody>
                {z1_rows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- ZONE 2: DELAYED PRODUCTION STAGES -->
        <tr>
          <td style="padding:14px 32px 10px;">
            <div style="margin-bottom:8px;">
              <span style="background:#ffedd5;color:#9a3412;font-size:11px;font-weight:800;padding:3px 8px;border-radius:4px;">ZONE 2</span>
              <strong style="font-size:13px;margin-left:8px;text-transform:uppercase;" class="text-title">Active Stages Delayed (Root Cause Statement Required)</strong>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;font-size:12px;overflow:hidden;" class="table-container">
              <thead>
                <tr class="table-header">
                  <th style="padding:10px 12px;text-align:left;">PO Reference</th>
                  <th style="padding:10px 12px;text-align:left;">Delayed Stage</th>
                  <th style="padding:10px 12px;text-align:left;">Planned Completion</th>
                  <th style="padding:10px 12px;text-align:center;">Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                {z2_rows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- ATTACHED EXCEL DOSSIER CARD -->
        <tr>
          <td style="padding:16px 32px 10px;">
            <div style="background:#0f172a;color:#ffffff;border-radius:8px;padding:20px 24px;">
              <div style="font-size:11px;font-weight:800;color:#38bdf8 !important;-webkit-text-fill-color:#38bdf8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
                <font color="#38bdf8">📎 Attached Interactive Excel Dossier</font>
              </div>
              <div style="font-size:14px;font-weight:700;color:#f8fafc !important;-webkit-text-fill-color:#f8fafc;margin-bottom:6px;">
                <font color="#f8fafc">File: <code style="color:#7dd3fc;background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;"><font color="#7dd3fc">{attachment_filename}</font></code></font>
              </div>
              <div style="font-size:13px;color:#cbd5e1 !important;-webkit-text-fill-color:#cbd5e1;line-height:1.5;">
                <font color="#cbd5e1">This Excel workbook contains separate tabs for each of the 6 Control Zones with <strong style="color:#ffffff !important;-webkit-text-fill-color:#ffffff;"><font color="#ffffff">one-click email action links</font></strong> to escalate directly to {manager_name}.</font>
              </div>
            </div>
          </td>
        </tr>

        <!-- CTA Button -->
        <tr>
          <td style="padding:20px 32px 28px;text-align:center;">
            <a href="{wip_url}" style="background:#0284c7;color:#ffffff !important;-webkit-text-fill-color:#ffffff;text-decoration:none;padding:15px 36px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;box-shadow:0 4px 14px rgba(2,132,199,0.4);">
              <font color="#ffffff">Open Live WIP Dashboard &amp; Download CSV →</font>
            </a>
            <div style="font-size:12px;margin-top:10px;" class="text-muted">
              Live Production Portal: <a href="{wip_url}" style="color:#0284c7;text-decoration:underline;">{wip_url}</a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;font-size:12px;line-height:1.6;" class="footer-box">
            <strong>Cotton Collective QC &amp; Production Management System</strong><br/>
            Server: <code>13.60.76.142</code> | Dispatch Relay: <code>qc@cottoncollective.org</code><br/>
            This email and any files transmitted with it are confidential and intended solely for the use of the individual or entity to whom they are addressed.
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""
    return subject, html


def dispatch_factory_isolated_emails(test_recipient: str = None):
    print("==================================================")
    print("🏭 Factory-Isolated 6 Control Zones Dispatcher")
    print(f"Test Override Recipient: {test_recipient or 'Live Factory Managers'}")
    print("==================================================")

    db = SessionLocal()
    try:
        today = date.today()
        base_url = getattr(settings, "APP_BASE_URL", "https://textileapperal.com").rstrip("/")
        if "localhost" in base_url:
            base_url = "https://textileapperal.com"
        wip_url = f"{base_url}/tracking-dashboard"

        # 1. Fetch Super Admin CCs
        super_admin_cc = get_super_admin_emails(db)
        print(f"[*] Super Admin CC List ({len(super_admin_cc)}): {super_admin_cc}")

        # 2. Group orders by factory
        all_orders = db.query(Order).filter(Order.is_active == True).all()
        factories: Dict[str, List[Order]] = {}
        for o in all_orders:
            vname = o.vendor.name if o.vendor and o.vendor.name else "Main Production Facility"
            factories.setdefault(vname, []).append(o)

        print(f"[*] Found {len(factories)} active production facilities.")

        # 3. Process each factory isolatedly
        for f_idx, (fname, o_list) in enumerate(factories.items(), 1):
            v = o_list[0].vendor if o_list else None
            mgr_name = v.assigned_manager.full_name if (v and v.assigned_manager) else "Factory Operations"
            raw_mgr_email = v.assigned_manager.email if (v and v.assigned_manager) else "qc@cottoncollective.org"

            # If user provided test_recipient, send to test_recipient for demonstration
            dest_email = test_recipient if test_recipient else raw_mgr_email

            safe_slug = "".join([c if c.isalnum() else "_" for c in fname])
            attachment_name = f"Cotton_Collective_Control_Zones_{safe_slug}_{today.strftime('%Y%m%d')}.xlsx"

            print(f"\n[{f_idx}/{len(factories)}] ----------------------------------------")
            print(f"🏭 Factory: {fname}")
            print(f"   Manager: {mgr_name} <{dest_email}>")
            print(f"   Orders in Scope: {len(o_list)} (Only {fname} data)")
            print(f"   CC: {super_admin_cc}")

            # Generate strictly isolated Excel workbook
            excel_io = build_factory_isolated_6_zones_workbook(
                factory_name=fname,
                factory_orders=o_list,
                manager_name=mgr_name,
                manager_email=raw_mgr_email,
                cc_emails=super_admin_cc,
            )
            excel_bytes = excel_io.getvalue()
            print(f"   Generated Isolated Excel: {attachment_name} ({len(excel_bytes)} bytes)")

            # Generate Dark/Light responsive HTML email
            subject, html = build_dark_light_responsive_email(
                factory_name=fname,
                manager_name=mgr_name,
                manager_email=raw_mgr_email,
                factory_orders=o_list,
                super_admin_cc=super_admin_cc,
                attachment_filename=attachment_name,
                wip_url=wip_url,
                today=today,
            )

            msg = _build_message(
                to=[dest_email],
                cc=super_admin_cc,
                subject=subject,
                html_body=html,
                attachments=[(attachment_name, excel_bytes)],
            )

            print(f"   Dispatching email with attachment to: {dest_email} (CC: {super_admin_cc})...")
            all_recips = list(set([dest_email] + super_admin_cc))
            _send_or_dryrun(msg, all_recips)
            print(f"✅ Dispatched successfully for {fname}!")

            # 60s cooldown if more factories remain
            if f_idx < len(factories):
                print("⏳ 1-Minute Safety Delay: Pacing next factory dispatch to protect domain reputation...")
                for rem in range(60, 0, -10):
                    print(f"   ... {rem}s remaining before next factory send")
                    time.sleep(10)

        print("\n🎉 ALL FACTORY-ISOLATED DISPATCHES COMPLETED SUCCESSFULLY!")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Send Factory-Isolated 6 Control Zones Emails")
    parser.add_argument("--test-to", help="Override destination email (e.g. faisalaslam1038@gmail.com)", default=None)
    args = parser.parse_args()
    dispatch_factory_isolated_emails(test_recipient=args.test_to)
