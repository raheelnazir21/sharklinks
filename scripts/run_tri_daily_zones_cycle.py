#!/usr/bin/env python3
"""
Cotton Collective - Tri-Daily (Every 3 Days) 6 Control Zones Automated Cycle
----------------------------------------------------------------------------
Both Super Admin and Factory Manager emails feature:
1. The 6 Control Zones Operational KPI Overview grid (from screenshot).
   - Zone 1: OVERDUE (Red)
   - Zone 2: STAGE DELAYS (Orange)
   - Zone 3: DUE IN 7 DAYS (Amber)
   - Zone 4: IN FINAL QC (Blue)
   - Zone 5: QC REWORK (Purple)
   - Zone 6: QC PASSED (Green)
   - For Super Admin: Shows global consolidated KPIs across all factories.
   - For Factory Manager: Shows strictly isolated KPIs for that factory only.
2. The user-friendly Excel Guide Dossier cards (What's Inside + Quick Start + Live WIP CTA).
3. The interactive multi-tab Excel workbooks attached directly.
4. Testing mode: Can send all 4 emails directly to faisalaslam1038@gmail.com with 60s cooldown.
"""
import os
import sys
import time
import argparse
from datetime import date, timedelta
from typing import List, Dict, Tuple, Any

# Path setup for local / docker environments
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.join(os.path.dirname(current_dir), "backend")
if os.path.exists(backend_path) and backend_path not in sys.path:
    sys.path.insert(0, backend_path)
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
if "/app" not in sys.path and os.path.exists("/app"):
    sys.path.insert(0, "/app")

from app.core.database import SessionLocal
from app.models.order import Order, OrderStatus, StageStatus
from app.models.user import User, Role, RoleEnum
from app.services.control_zones_excel_builder import (
    build_multi_factory_6_zones_workbook,
    build_factory_isolated_6_zones_workbook,
    classify_order_zone,
)
from app.services.email_service import _build_message, _send_or_dryrun
from app.core.config import settings


def get_super_admin_emails(db) -> List[str]:
    """Retrieves all active Super Admin emails from DB, ensuring Faisal Aslam & QC are present."""
    super_admins = db.query(User).join(Role).filter(
        Role.name == RoleEnum.super_admin,
        User.is_active == True
    ).all()
    emails = [u.email.strip() for u in super_admins if u.email and "@" in u.email]
    for fallback in ["faisalaslam1038@gmail.com", "qc@cottoncollective.org", "raheel.safelife@gmail.com"]:
        if fallback not in emails:
            emails.append(fallback)
    return list(dict.fromkeys(emails))


def compute_kpi_counts(orders: List[Order], today: date) -> Dict[str, Any]:
    """Calculates the 6 Control Zones metrics for any given list of orders."""
    z1 = 0
    z3 = 0
    z4 = 0
    z5 = 0
    z6 = 0
    delayed_stages_count = 0

    for o in orders:
        if not o.is_active or o.status == OrderStatus.cancelled:
            continue
        z = classify_order_zone(o, today)
        if z == 1:
            z1 += 1
        elif z == 3:
            z3 += 1
        elif z == 4:
            z4 += 1
        elif z == 5:
            z5 += 1
        elif z == 6:
            z6 += 1

        for s in o.stages:
            if s.status not in (StageStatus.completed, StageStatus.skipped) and s.target_date:
                st = s.target_date.date() if hasattr(s.target_date, "date") else s.target_date
                if st < today:
                    delayed_stages_count += 1

    return {
        "z1": z1,
        "z2": delayed_stages_count,
        "z3": z3,
        "z4": z4,
        "z5": z5,
        "z6": z6,
    }


def _render_kpi_grid_html(kpi_title: str, kpi: Dict[str, Any]) -> str:
    """Renders the exact 6-card KPI overview grid from the screenshot."""
    return f"""
        <!-- 6 Control Zones Operational KPI Overview Grid -->
        <tr>
          <td style="padding:4px 32px 18px;">
            <div style="font-size:12px;font-weight:800;letter-spacing:1px;color:#475569;text-transform:uppercase;margin-bottom:10px;" class="text-muted">
              {kpi_title}
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:10px;margin-left:-10px;margin-right:-10px;">
              <tr>
                <td width="33%" style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:16px 10px;text-align:center;border-top:4px solid #dc2626;box-shadow:0 1px 3px rgba(0,0,0,0.06);" class="kpi-box">
                  <div style="font-size:28px;font-weight:800;color:#dc2626;line-height:1;" class="text-rose">{kpi['z1']}</div>
                  <div style="font-size:11px;font-weight:800;color:#b91c1c;letter-spacing:0.8px;text-transform:uppercase;margin-top:6px;" class="text-rose">ZONE 1: OVERDUE</div>
                </td>
                <td width="33%" style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:16px 10px;text-align:center;border-top:4px solid #ea580c;box-shadow:0 1px 3px rgba(0,0,0,0.06);" class="kpi-box">
                  <div style="font-size:28px;font-weight:800;color:#ea580c;line-height:1;" class="text-orange">{kpi['z2']}</div>
                  <div style="font-size:11px;font-weight:800;color:#c2410c;letter-spacing:0.8px;text-transform:uppercase;margin-top:6px;" class="text-orange">ZONE 2: STAGE DELAYS</div>
                </td>
                <td width="33%" style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:16px 10px;text-align:center;border-top:4px solid #d97706;box-shadow:0 1px 3px rgba(0,0,0,0.06);" class="kpi-box">
                  <div style="font-size:28px;font-weight:800;color:#d97706;line-height:1;" class="text-amber">{kpi['z3']}</div>
                  <div style="font-size:11px;font-weight:800;color:#b45309;letter-spacing:0.8px;text-transform:uppercase;margin-top:6px;" class="text-amber">ZONE 3: DUE IN 7 DAYS</div>
                </td>
              </tr>
              <tr>
                <td width="33%" style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:16px 10px;text-align:center;border-top:4px solid #0284c7;box-shadow:0 1px 3px rgba(0,0,0,0.06);" class="kpi-box">
                  <div style="font-size:28px;font-weight:800;color:#0284c7;line-height:1;" class="text-blue">{kpi['z4']}</div>
                  <div style="font-size:11px;font-weight:800;color:#0369a1;letter-spacing:0.8px;text-transform:uppercase;margin-top:6px;" class="text-blue">ZONE 4: IN FINAL QC</div>
                </td>
                <td width="33%" style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:16px 10px;text-align:center;border-top:4px solid #7c3aed;box-shadow:0 1px 3px rgba(0,0,0,0.06);" class="kpi-box">
                  <div style="font-size:28px;font-weight:800;color:#7c3aed;line-height:1;" class="text-muted">{kpi['z5']} Active</div>
                  <div style="font-size:11px;font-weight:800;color:#6d28d9;letter-spacing:0.8px;text-transform:uppercase;margin-top:6px;" class="text-muted">ZONE 5: QC REWORK</div>
                </td>
                <td width="33%" style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:16px 10px;text-align:center;border-top:4px solid #16a34a;box-shadow:0 1px 3px rgba(0,0,0,0.06);" class="kpi-box">
                  <div style="font-size:28px;font-weight:800;color:#16a34a;line-height:1;" class="text-green">{kpi['z6']}</div>
                  <div style="font-size:11px;font-weight:800;color:#15803d;letter-spacing:0.8px;text-transform:uppercase;margin-top:6px;" class="text-green">ZONE 6: QC PASSED</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>"""


# ─────────────────────────────────────────────────────────────────────────────
# 1. SUPER ADMIN DOSSIER EMAIL (GLOBAL KPIS + MASTER EXCEL)
# ─────────────────────────────────────────────────────────────────────────────
def build_super_admin_dossier_email(
    today: date,
    file_name: str,
    wip_url: str,
    factories_list: List[str],
    kpi: Dict[str, Any],
) -> Tuple[str, str]:
    subject = f"📊 [EXECUTIVE DOSSIER • 3-DAY CYCLE] Cotton Collective Multi-Factory 6 Control Zones Schedule — {today.strftime('%d %b %Y')}"

    factories_str = ", ".join([f"<strong>{f}</strong>" for f in factories_list]) if factories_list else "All Active Facilities"
    kpi_grid_html = _render_kpi_grid_html("EXECUTIVE OPERATIONAL KPI OVERVIEW", kpi)

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
    body, .email-bg {{ background-color: #f1f5f9; color: #1e293b; }}
    .email-card {{ background-color: #ffffff; border: 1px solid #cbd5e1; }}
    .meta-box {{ background-color: #f8fafc; border: 1px solid #cbd5e1; color: #334155; }}
    .kpi-box {{ background-color: #ffffff; border: 1px solid #cbd5e1; }}
    .green-box {{ background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; }}
    .title-text {{ color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }}
    .subtitle-text {{ color: #38bdf8 !important; -webkit-text-fill-color: #38bdf8 !important; }}
    .caption-text {{ color: #cbd5e1 !important; -webkit-text-fill-color: #cbd5e1 !important; }}
    .body-text {{ color: #1e293b; }}
    .footer-box {{ background-color: #f8fafc; border-top: 1px solid #e2e8f0; color: #64748b; }}

    /* Dark Mode Overrides */
    @media (prefers-color-scheme: dark) {{
      body, .email-bg {{ background-color: #0b0f19 !important; color: #f8fafc !important; }}
      .email-card {{ background-color: #111827 !important; border-color: #1f2937 !important; box-shadow: 0 10px 30px rgba(0,0,0,0.6) !important; }}
      .header-cell {{ background-color: #0f172a !important; }}
      .title-text {{ color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }}
      .subtitle-text {{ color: #38bdf8 !important; -webkit-text-fill-color: #38bdf8 !important; }}
      .caption-text {{ color: #cbd5e1 !important; -webkit-text-fill-color: #cbd5e1 !important; }}
      .body-text {{ color: #e2e8f0 !important; }}
      .meta-box {{ background-color: #1a2234 !important; border-color: #2d3748 !important; color: #e2e8f0 !important; }}
      .meta-box strong {{ color: #f8fafc !important; }}
      .kpi-box {{ background-color: #1a2234 !important; border-color: #2d3748 !important; }}
      .green-box {{ background-color: #064e3b !important; border-color: #047857 !important; }}
      .green-box div {{ color: #a7f3d0 !important; }}
      .footer-box {{ background-color: #0f172a !important; border-color: #1e293b !important; color: #94a3b8 !important; }}
    }}

    [data-ogsc] .header-cell {{ background-color: #0f172a !important; }}
    [data-ogsc] .title-text {{ color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }}
    [data-ogsc] .subtitle-text {{ color: #38bdf8 !important; -webkit-text-fill-color: #38bdf8 !important; }}
    [data-ogsc] .caption-text {{ color: #cbd5e1 !important; -webkit-text-fill-color: #cbd5e1 !important; }}
  </style>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;" class="email-bg">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 0;" class="email-bg">
    <tr><td align="center">
      <table width="680" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.12);" class="email-card">
        
        <!-- Header (Deep Slate Navy #0f172a, Dark Mode Immune) -->
        <tr>
          <td bgcolor="#0f172a" class="header-cell" style="background-color:#0f172a;padding:26px 32px;border-bottom:3px solid #0284c7;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div class="subtitle-text" style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#38bdf8 !important;-webkit-text-fill-color:#38bdf8;text-transform:uppercase;margin-bottom:6px;">
                    <font color="#38bdf8">COTTON COLLECTIVE • EXECUTIVE PRODUCTION &amp; QUALITY MANAGEMENT</font>
                  </div>
                  <div class="title-text" style="font-size:24px;font-weight:800;color:#ffffff !important;-webkit-text-fill-color:#ffffff;letter-spacing:-0.5px;line-height:1.2;">
                    <font color="#ffffff">Multi-Factory 6 Control Zones Dossier</font>
                  </div>
                  <div class="caption-text" style="font-size:13px;color:#cbd5e1 !important;-webkit-text-fill-color:#cbd5e1;margin-top:6px;">
                    <font color="#cbd5e1">Attached: <strong class="title-text" style="color:#ffffff !important;-webkit-text-fill-color:#ffffff;"><font color="#ffffff">{file_name}</font></strong> (Interactive Excel Sheet with direct email links)</font>
                  </div>
                </td>
                <td align="right" valign="top">
                  <span style="background:#1e293b;border:1px solid #334155;color:#38bdf8 !important;-webkit-text-fill-color:#38bdf8;font-size:11px;font-weight:700;padding:6px 14px;border-radius:20px;text-transform:uppercase;letter-spacing:0.8px;display:inline-block;">
                    <font color="#38bdf8">Live AWS Data</font>
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Intro -->
        <tr>
          <td style="padding:28px 32px 14px;font-size:15px;line-height:1.6;" class="body-text">
            Dear Factory Operations, Merchandising &amp; Executive Teams,<br/><br/>
            As requested, we have upgraded our operational reporting into a <strong>user-friendly, multi-tab interactive Excel Workbook</strong> attached directly to this email:
          </td>
        </tr>

        {kpi_grid_html}

        <!-- Feature Highlights Card -->
        <tr>
          <td style="padding:0 32px 16px;">
            <div style="border-radius:10px;padding:20px 24px;" class="meta-box">
              <div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">
                📑 WHAT IS INSIDE THE ATTACHED EXCEL WORKBOOK:
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.7;">
                <tr>
                  <td width="30" valign="top">📊</td>
                  <td class="body-text"><strong>Tab 1: Master Summary (All Factories)</strong> — Consolidated global view of all purchase orders across all facilities with status badges and KPI metrics.</td>
                </tr>
                <tr><td colspan="2" height="10"></td></tr>
                <tr>
                  <td width="30" valign="top">🏭</td>
                  <td class="body-text"><strong>Individual Factory Tabs</strong> — Separate sheets for {factories_str}.</td>
                </tr>
                <tr><td colspan="2" height="10"></td></tr>
                <tr>
                  <td width="30" valign="top">🎯</td>
                  <td class="body-text"><strong>All 6 Control Zones Per Factory</strong> — Every factory sheet is clearly segmented into Zone 1 (Overdue), Zone 2 (Stage Delay), Zone 3 (Due in 7 Days), Zone 4 (In Final QC), Zone 5 (Rework), and Zone 6 (Cleared Shipment).</td>
                </tr>
                <tr><td colspan="2" height="10"></td></tr>
                <tr>
                  <td width="30" valign="top">✉️</td>
                  <td class="body-text"><strong>One-Click Manager Email Links</strong> — Column J features active <code>mailto:</code> links that immediately open a pre-addressed email to the assigned factory manager with the order details and subject line filled in!</td>
                </tr>
                <tr><td colspan="2" height="10"></td></tr>
                <tr>
                  <td width="30" valign="top">🔗</td>
                  <td class="body-text"><strong>Direct Portal Links</strong> — Column K links straight to the live PO page on <code>https://textileapperal.com</code>.</td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- Quick Start -->
        <tr>
          <td style="padding:10px 32px 20px;">
            <div style="border-radius:8px;padding:16px 20px;" class="green-box">
              <div style="font-size:13px;font-weight:800;text-transform:uppercase;margin-bottom:6px;color:#15803d;">
                💡 QUICK START:
              </div>
              <div style="font-size:13px;line-height:1.6;color:#166534;">
                1. Open the attached file: <strong>{file_name}</strong> in Excel or Google Sheets.<br/>
                2. Select your factory tab (e.g. <em>BENCHENG FACTORY</em>).<br/>
                3. Review your Zone 1 and Zone 2 priorities.<br/>
                4. Click <strong>"✉️ Email Manager"</strong> to immediately escalate any order directly to the manager.
              </div>
            </div>
          </td>
        </tr>

        <!-- CTA Button -->
        <tr>
          <td style="padding:16px 32px 30px;text-align:center;">
            <a href="{wip_url}" style="background:#0284c7;color:#ffffff !important;-webkit-text-fill-color:#ffffff;text-decoration:none;padding:15px 36px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;box-shadow:0 4px 14px rgba(2,132,199,0.4);">
              <font color="#ffffff">Open Live WIP Tracking Dashboard &amp; Download CSV →</font>
            </a>
            <div style="font-size:12px;margin-top:10px;" class="footer-box">
              Production Portal: <a href="{wip_url}" style="color:#0284c7;text-decoration:underline;">{wip_url}</a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;font-size:12px;line-height:1.6;" class="footer-box">
            <strong>Cotton Collective QC &amp; Production Management System</strong><br/>
            Live AWS Server: <code>13.60.76.142</code> | Outbound Relay: <code>qc@cottoncollective.org</code>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""
    return subject, html


# ─────────────────────────────────────────────────────────────────────────────
# 2. FACTORY MANAGER DOSSIER EMAIL (FACTORY-ISOLATED KPIS + ISOLATED EXCEL)
# ─────────────────────────────────────────────────────────────────────────────
def build_factory_manager_dossier_email(
    today: date,
    factory_name: str,
    manager_name: str,
    file_name: str,
    wip_url: str,
    total_orders: int,
    kpi: Dict[str, Any],
) -> Tuple[str, str]:
    subject = f"📊 [FACTORY DOSSIER • 3-DAY CYCLE] Cotton Collective 6 Control Zones: {factory_name.upper()} — {today.strftime('%d %b %Y')}"

    kpi_grid_html = _render_kpi_grid_html(f"OPERATIONAL KPI OVERVIEW: {factory_name.upper()}", kpi)

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
    body, .email-bg {{ background-color: #f1f5f9; color: #1e293b; }}
    .email-card {{ background-color: #ffffff; border: 1px solid #cbd5e1; }}
    .meta-box {{ background-color: #f8fafc; border: 1px solid #cbd5e1; color: #334155; }}
    .kpi-box {{ background-color: #ffffff; border: 1px solid #cbd5e1; }}
    .green-box {{ background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; }}
    .title-text {{ color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }}
    .subtitle-text {{ color: #38bdf8 !important; -webkit-text-fill-color: #38bdf8 !important; }}
    .caption-text {{ color: #cbd5e1 !important; -webkit-text-fill-color: #cbd5e1 !important; }}
    .body-text {{ color: #1e293b; }}
    .footer-box {{ background-color: #f8fafc; border-top: 1px solid #e2e8f0; color: #64748b; }}

    /* Dark Mode Overrides */
    @media (prefers-color-scheme: dark) {{
      body, .email-bg {{ background-color: #0b0f19 !important; color: #f8fafc !important; }}
      .email-card {{ background-color: #111827 !important; border-color: #1f2937 !important; box-shadow: 0 10px 30px rgba(0,0,0,0.6) !important; }}
      .header-cell {{ background-color: #0f172a !important; }}
      .title-text {{ color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }}
      .subtitle-text {{ color: #38bdf8 !important; -webkit-text-fill-color: #38bdf8 !important; }}
      .caption-text {{ color: #cbd5e1 !important; -webkit-text-fill-color: #cbd5e1 !important; }}
      .body-text {{ color: #e2e8f0 !important; }}
      .meta-box {{ background-color: #1a2234 !important; border-color: #2d3748 !important; color: #e2e8f0 !important; }}
      .meta-box strong {{ color: #f8fafc !important; }}
      .kpi-box {{ background-color: #1a2234 !important; border-color: #2d3748 !important; }}
      .green-box {{ background-color: #064e3b !important; border-color: #047857 !important; }}
      .green-box div {{ color: #a7f3d0 !important; }}
      .footer-box {{ background-color: #0f172a !important; border-color: #1e293b !important; color: #94a3b8 !important; }}
    }}

    [data-ogsc] .header-cell {{ background-color: #0f172a !important; }}
    [data-ogsc] .title-text {{ color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }}
    [data-ogsc] .subtitle-text {{ color: #38bdf8 !important; -webkit-text-fill-color: #38bdf8 !important; }}
    [data-ogsc] .caption-text {{ color: #cbd5e1 !important; -webkit-text-fill-color: #cbd5e1 !important; }}
  </style>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;" class="email-bg">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 0;" class="email-bg">
    <tr><td align="center">
      <table width="680" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.12);" class="email-card">
        
        <!-- Header (Deep Slate Navy #0f172a, Dark Mode Immune) -->
        <tr>
          <td bgcolor="#0f172a" class="header-cell" style="background-color:#0f172a;padding:26px 32px;border-bottom:3px solid #0284c7;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div class="subtitle-text" style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#38bdf8 !important;-webkit-text-fill-color:#38bdf8;text-transform:uppercase;margin-bottom:6px;">
                    <font color="#38bdf8">COTTON COLLECTIVE • PRODUCTION &amp; QUALITY DIRECTIVE</font>
                  </div>
                  <div class="title-text" style="font-size:24px;font-weight:800;color:#ffffff !important;-webkit-text-fill-color:#ffffff;letter-spacing:-0.5px;line-height:1.2;">
                    <font color="#ffffff">6 Control Zones Dossier: {factory_name.upper()}</font>
                  </div>
                  <div class="caption-text" style="font-size:13px;color:#cbd5e1 !important;-webkit-text-fill-color:#cbd5e1;margin-top:6px;">
                    <font color="#cbd5e1">Attached: <strong class="title-text" style="color:#ffffff !important;-webkit-text-fill-color:#ffffff;"><font color="#ffffff">{file_name}</font></strong> (Interactive Excel Sheet with direct email links)</font>
                  </div>
                </td>
                <td align="right" valign="top">
                  <span style="background:#1e293b;border:1px solid #334155;color:#38bdf8 !important;-webkit-text-fill-color:#38bdf8;font-size:11px;font-weight:700;padding:6px 14px;border-radius:20px;text-transform:uppercase;letter-spacing:0.8px;display:inline-block;">
                    <font color="#38bdf8">Factory Directive</font>
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Intro -->
        <tr>
          <td style="padding:28px 32px 14px;font-size:15px;line-height:1.6;" class="body-text">
            Dear {manager_name} &amp; {factory_name} Production Operations Teams,<br/><br/>
            As requested, we have upgraded our operational reporting into a <strong>user-friendly, multi-tab interactive Excel Workbook</strong> attached directly to this email:
          </td>
        </tr>

        {kpi_grid_html}

        <!-- Feature Highlights Card -->
        <tr>
          <td style="padding:0 32px 16px;">
            <div style="border-radius:10px;padding:20px 24px;" class="meta-box">
              <div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">
                📑 WHAT IS INSIDE YOUR ATTACHED EXCEL WORKBOOK:
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.7;">
                <tr>
                  <td width="30" valign="top">📊</td>
                  <td class="body-text"><strong>Tab 1: {factory_name} Summary</strong> — Consolidated operational view of all {total_orders} purchase orders for your facility with live KPI metrics and status badges.</td>
                </tr>
                <tr><td colspan="2" height="10"></td></tr>
                <tr>
                  <td width="30" valign="top">🎯</td>
                  <td class="body-text"><strong>All 6 Control Zones Dedicated Tabs</strong> — Clearly segmented into Zone 1 (Overdue), Zone 2 (Stage Delay), Zone 3 (Due in 7 Days), Zone 4 (In Final QC), Zone 5 (Rework), and Zone 6 (Cleared Shipment).</td>
                </tr>
                <tr><td colspan="2" height="10"></td></tr>
                <tr>
                  <td width="30" valign="top">✉️</td>
                  <td class="body-text"><strong>One-Click Escalation Email Links</strong> — Column J features active <code>mailto:</code> links that immediately open a pre-addressed email with order details and subject line filled in!</td>
                </tr>
                <tr><td colspan="2" height="10"></td></tr>
                <tr>
                  <td width="30" valign="top">🔗</td>
                  <td class="body-text"><strong>Direct Portal Links</strong> — Column K links straight to the live PO page on <code>https://textileapperal.com</code>.</td>
                </tr>
                <tr><td colspan="2" height="10"></td></tr>
                <tr>
                  <td width="30" valign="top">🔒</td>
                  <td class="body-text"><strong>Data Confidentiality</strong> — This dossier contains strictly {factory_name} purchase orders with zero cross-factory visibility.</td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- Quick Start -->
        <tr>
          <td style="padding:10px 32px 20px;">
            <div style="border-radius:8px;padding:16px 20px;" class="green-box">
              <div style="font-size:13px;font-weight:800;text-transform:uppercase;margin-bottom:6px;color:#15803d;">
                💡 QUICK START:
              </div>
              <div style="font-size:13px;line-height:1.6;color:#166534;">
                1. Open the attached file: <strong>{file_name}</strong> in Excel or Google Sheets.<br/>
                2. Review your <strong>Zone 1 (Overdue)</strong> and <strong>Zone 2 (Stage Delay)</strong> priorities.<br/>
                3. Click <strong>"✉️ Email Manager"</strong> to immediately escalate any critical PO directly with production.<br/>
                4. Submit your updated weekly WIP CSV report through the tracking portal.
              </div>
            </div>
          </td>
        </tr>

        <!-- CTA Button -->
        <tr>
          <td style="padding:16px 32px 30px;text-align:center;">
            <a href="{wip_url}" style="background:#0284c7;color:#ffffff !important;-webkit-text-fill-color:#ffffff;text-decoration:none;padding:15px 36px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;box-shadow:0 4px 14px rgba(2,132,199,0.4);">
              <font color="#ffffff">Open Live WIP Tracking Dashboard &amp; Download CSV →</font>
            </a>
            <div style="font-size:12px;margin-top:10px;" class="footer-box">
              Production Portal: <a href="{wip_url}" style="color:#0284c7;text-decoration:underline;">{wip_url}</a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;font-size:12px;line-height:1.6;" class="footer-box">
            <strong>Cotton Collective QC &amp; Production Management System</strong><br/>
            Live AWS Server: <code>13.60.76.142</code> | Outbound Relay: <code>qc@cottoncollective.org</code>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""
    return subject, html


# ─────────────────────────────────────────────────────────────────────────────
# 3. TRI-DAILY MASTER DISPATCHER ORCHESTRATION
# ─────────────────────────────────────────────────────────────────────────────
def run_tri_daily_zones_cycle(
    test_recipient: str = None,
    dry_run: bool = False,
    admin_only: bool = False,
    factory_filter: str = None,
    skip_admin: bool = False,
):
    today = date.today()
    base_url = getattr(settings, "APP_BASE_URL", "https://textileapperal.com").rstrip("/")
    if "localhost" in base_url:
        base_url = "https://textileapperal.com"
    wip_url = f"{base_url}/tracking-dashboard"

    print("====================================================================")
    print("🔁 COTTON COLLECTIVE: 3-DAY 6 CONTROL ZONES AUTOMATED CYCLE")
    print(f"Date: {today.strftime('%A, %d %B %Y')}")
    print(f"Test Override: {test_recipient or 'Disabled (Live Production Routing)'}")
    print(f"Dry Run Mode: {dry_run}")
    print("====================================================================")

    db = SessionLocal()
    try:
        # Step A: Query Super Admins and active orders
        super_admin_emails = get_super_admin_emails(db)
        print(f"[*] Super Admin List ({len(super_admin_emails)}): {super_admin_emails}")

        all_active_orders = db.query(Order).filter(Order.is_active == True).all()
        print(f"[*] Total active purchase orders retrieved: {len(all_active_orders)}")

        # Group orders by manufacturing facility
        factories_map: Dict[str, List[Order]] = {}
        for o in all_active_orders:
            vname = o.vendor.name if o.vendor and o.vendor.name else "Main Production Facility"
            if factory_filter and factory_filter.lower() not in vname.lower():
                continue
            factories_map.setdefault(vname, []).append(o)

        factories_list = sorted(list(factories_map.keys()))
        print(f"[*] Active facilities identified ({len(factories_list)}): {factories_list}")

        # Compute global portfolio KPIs
        global_kpis = compute_kpi_counts(all_active_orders, today)
        print(f"[*] Global Portfolio KPIs: {global_kpis}")

        # ─── PART 1: DISPATCH SUPER ADMIN EXECUTIVE PORTFOLIO DOSSIER ───
        if not skip_admin:
            print("\n" + "=" * 60)
            print("👑 STEP 1: GENERATING SUPER ADMIN EXECUTIVE PORTFOLIO DOSSIER")
            print("=" * 60)

            admin_excel_io = build_multi_factory_6_zones_workbook(all_active_orders)
            admin_excel_bytes = admin_excel_io.getvalue()
            admin_file_name = f"Cotton_Collective_6_Zones_Master_Dossier_{today.strftime('%Y%m%d')}.xlsx"
            print(f"[*] Built Master Multi-Factory Workbook: {admin_file_name} ({len(admin_excel_bytes)} bytes)")

            admin_subject, admin_html = build_super_admin_dossier_email(
                today=today,
                file_name=admin_file_name,
                wip_url=wip_url,
                factories_list=factories_list,
                kpi=global_kpis,
            )

            admin_dest = [test_recipient] if test_recipient else super_admin_emails
            print(f"[*] Dispatching Super Admin Dossier to: {admin_dest}")

            if not dry_run:
                msg = _build_message(
                    to=admin_dest,
                    cc=[],
                    subject=admin_subject,
                    html_body=admin_html,
                    attachments=[(admin_file_name, admin_excel_bytes)],
                )
                _send_or_dryrun(msg, admin_dest)
                print("✅ Super Admin Executive Portfolio Dossier dispatched successfully!")
            else:
                print("🔍 [DRY RUN] Skipped actual SMTP send for Super Admin Dossier.")
        else:
            print("\n⏭️ Skipping Super Admin Dossier (skip-admin set).")

        if admin_only:
            print("\n🏁 Admin-only flag set. Skipping factory manager cycle.")
            return

        # ─── PART 2: DISPATCH FACTORY-ISOLATED DIRECTIVE EMAILS ──────────
        print("\n" + "=" * 60)
        print(f"🏭 STEP 2: DISPATCHING FACTORY-ISOLATED DIRECTIVES ({len(factories_map)} FACILITIES)")
        print("=" * 60)

        for f_idx, (fname, o_list) in enumerate(factories_map.items(), 1):
            # Enforce 60s cooldown between all emails
            print(f"\n⏳ Enforcing 60-Second Cooldown before factory [{f_idx}/{len(factories_map)}: {fname}]...")
            if not dry_run:
                time.sleep(60)

            v = o_list[0].vendor if o_list else None
            mgr_name = v.assigned_manager.full_name if (v and v.assigned_manager) else "Factory Operations"
            mgr_email = v.assigned_manager.email if (v and v.assigned_manager) else "qc@cottoncollective.org"

            # Determine routing: In testing mode, send only to test_recipient with no factory emails
            dest_mgr = test_recipient if test_recipient else mgr_email
            dest_cc = [] if test_recipient else super_admin_emails

            safe_slug = "".join([c if c.isalnum() else "_" for c in fname])
            factory_file_name = f"Cotton_Collective_6_Zones_{safe_slug}_{today.strftime('%Y%m%d')}.xlsx"

            # Compute strictly isolated KPIs for this factory
            factory_kpis = compute_kpi_counts(o_list, today)

            print(f"[{f_idx}/{len(factories_map)}] Processing Factory: {fname}")
            print(f"   Target Manager: {mgr_name} <{dest_mgr}>")
            print(f"   Super Admin CC: {dest_cc}")
            print(f"   Isolated Orders: {len(o_list)} orders")
            print(f"   Factory KPIs: {factory_kpis}")

            # Generate strictly isolated Excel workbook
            fac_excel_io = build_factory_isolated_6_zones_workbook(
                factory_name=fname,
                factory_orders=o_list,
                manager_name=mgr_name,
                manager_email=mgr_email,
                cc_emails=dest_cc,
            )
            fac_excel_bytes = fac_excel_io.getvalue()
            print(f"   Built Isolated Workbook: {factory_file_name} ({len(fac_excel_bytes)} bytes)")

            # Generate clean dossier format HTML for the manager with their isolated KPIs
            fac_subject, fac_html = build_factory_manager_dossier_email(
                today=today,
                factory_name=fname,
                manager_name=mgr_name,
                file_name=factory_file_name,
                wip_url=wip_url,
                total_orders=len(o_list),
                kpi=factory_kpis,
            )

            if not dry_run:
                fac_msg = _build_message(
                    to=[dest_mgr],
                    cc=dest_cc,
                    subject=fac_subject,
                    html_body=fac_html,
                    attachments=[(factory_file_name, fac_excel_bytes)],
                )
                all_recips = list(set([dest_mgr] + dest_cc))
                _send_or_dryrun(fac_msg, all_recips)
                print(f"✅ Dispatched isolated directive successfully for {fname}!")
            else:
                print(f"🔍 [DRY RUN] Skipped actual SMTP send for {fname}.")

        print("\n🎉 TRI-DAILY 6 CONTROL ZONES CYCLE COMPLETED SUCCESSFULLY!")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Tri-Daily 6 Control Zones Automated Cycle")
    parser.add_argument("--test-to", help="Override destination email (e.g. faisalaslam1038@gmail.com)", default=None)
    parser.add_argument("--dry-run", help="Simulate execution without sending emails", action="store_true")
    parser.add_argument("--admin-only", help="Send only the Super Admin executive portfolio dossier", action="store_true")
    parser.add_argument("--skip-admin", help="Skip the Super Admin dossier send", action="store_true")
    parser.add_argument("--factory", help="Filter to a specific factory (e.g. BENCHENG FACTORY)", default=None)
    args = parser.parse_args()

    run_tri_daily_zones_cycle(
        test_recipient=args.test_to,
        dry_run=args.dry_run,
        admin_only=args.admin_only,
        factory_filter=args.factory,
        skip_admin=args.skip_admin,
    )
