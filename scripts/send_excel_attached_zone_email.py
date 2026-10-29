#!/usr/bin/env python3
"""
Dispatches the new user-friendly email with the multi-factory 6 Control Zones
Excel sheet attached to: faisalaslam1038@gmail.com
- Optimized for both Dark Mode & Light Mode (fixes Gmail header inversion bug)
"""
import os
import sys
from datetime import date

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.join(os.path.dirname(current_dir), "backend")
if os.path.exists(backend_path) and backend_path not in sys.path:
    sys.path.insert(0, backend_path)
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from app.core.database import SessionLocal
from app.models.order import Order
from app.services.control_zones_excel_builder import build_multi_factory_6_zones_workbook
from app.services.email_service import _build_message, _send_or_dryrun
from app.core.config import settings

def main():
    recipient = "faisalaslam1038@gmail.com"
    today = date.today()
    base_url = getattr(settings, "APP_BASE_URL", "https://textileapperal.com").rstrip("/")
    if "localhost" in base_url:
        base_url = "https://textileapperal.com"
    wip_url = f"{base_url}/tracking-dashboard"

    print("==================================================")
    print("🚀 Generating Multi-Factory Excel Dossier & Email")
    print(f"Target: {recipient}")
    print("==================================================")

    db = SessionLocal()
    try:
        orders = db.query(Order).all()
        print(f"[*] Compiling live data for {len(orders)} orders...")

        excel_io = build_multi_factory_6_zones_workbook(orders)
        excel_bytes = excel_io.getvalue()
        file_name = f"Cotton_Collective_6_Zones_Master_Dossier_{today.strftime('%Y%m%d')}.xlsx"
        print(f"[*] Generated Excel attachment: {file_name} ({len(excel_bytes)} bytes)")

        subject = f"📊 [EXECUTIVE DOSSIER + ATTACHED EXCEL] Cotton Collective 6 Control Zones Multi-Factory Schedule — {today.strftime('%d %b %Y')}"

        body_html = f"""<!DOCTYPE html>
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
        
        <!-- Header (Deep Slate Navy #0f172a, immune to Gmail dark mode inversion) -->
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
          <td style="padding:28px 32px 16px;font-size:15px;line-height:1.6;" class="body-text">
            Dear Factory Operations, Merchandising &amp; Executive Teams,<br/><br/>
            As requested, we have upgraded our operational reporting into a <strong>user-friendly, multi-tab interactive Excel Workbook</strong> attached directly to this email:
          </td>
        </tr>

        <!-- Feature Highlights Card -->
        <tr>
          <td style="padding:0 32px 16px;">
            <div style="border-radius:10px;padding:20px 24px;" class="meta-box">
              <div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">
                📑 What is Inside the Attached Excel Workbook:
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.7;">
                <tr>
                  <td width="30" valign="top">📊</td>
                  <td class="body-text"><strong>Tab 1: Master Summary (All Factories)</strong> — Consolidated global view of all purchase orders across all facilities with status badges and KPI metrics.</td>
                </tr>
                <tr><td colspan="2" height="10"></td></tr>
                <tr>
                  <td width="30" valign="top">🏭</td>
                  <td class="body-text"><strong>Individual Factory Tabs</strong> — Separate sheets for <strong>BENCHENG FACTORY</strong>, <strong>Yumnin Factory</strong>, and <strong>ShenHong Garment</strong>.</td>
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

        <!-- How to use -->
        <tr>
          <td style="padding:10px 32px 20px;">
            <div style="border-radius:8px;padding:16px 20px;" class="green-box">
              <div style="font-size:13px;font-weight:800;text-transform:uppercase;margin-bottom:6px;color:#15803d;">
                💡 Quick Start:
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

        msg = _build_message(
            to=[recipient],
            cc=[],
            subject=subject,
            html_body=body_html,
            attachments=[(file_name, excel_bytes)],
        )

        print("[*] Dispatching email with Excel attachment via SMTP...")
        _send_or_dryrun(msg, [recipient])
        print(f"✅ SUCCESSFULLY SENT EXCEL-ATTACHED EMAIL TO {recipient}!")

    finally:
        db.close()

if __name__ == "__main__":
    main()
