#!/usr/bin/env python3
"""
render_notification_screenshots.py
Renders high-fidelity screenshots for the Operating Handbook:
- 74-notification-center-dropdown.png: Refined Lead Manager style notification dropdown
- 75-zone1-zone2-capa-documentation.png: Zone 1 & Zone 2 CAPA documentation modal
"""
import os
import subprocess

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))
SCREENSHOTS_DIR = os.path.join(DOCS_DIR, "screenshots")
CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

HTML_NOTIF_DROPDOWN_74 = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  body {
    background: #f1f5f9;
    padding: 30px;
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    min-height: 720px;
  }
  .container {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
  }
  /* Top Bar Mock */
  .top-bar-mock {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #ffffff;
    padding: 8px 16px;
    border-radius: 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    border: 1px solid #e2e8f0;
  }
  .bell-btn {
    position: relative;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1e293b;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .bell-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    background: #0284c7;
    color: #ffffff;
    font-size: 10px;
    font-weight: 800;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #ffffff;
  }
  .user-chip {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 12px 4px 6px;
    border-radius: 18px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
  }
  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #d4a373;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    font-weight: 800;
    font-size: 14px;
    border: 2px solid #fefae0;
  }
  .user-info {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  .user-name {
    font-size: 13px;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: 0.3px;
  }
  .user-sub {
    font-size: 11px;
    color: #64748b;
    font-weight: 600;
  }
  .user-chevron {
    color: #94a3b8;
    font-size: 12px;
    margin-left: 2px;
  }

  /* Dropdown Card */
  .notif-card {
    width: 460px;
    background: #ffffff;
    border-radius: 24px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.2);
    overflow: hidden;
  }
  .notif-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #f1f5f9;
    background: #ffffff;
  }
  .notif-header h3 {
    font-size: 17px;
    font-weight: 800;
    color: #0f172a;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sound-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #cbd5e1;
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 700;
    color: #334155;
    background: #ffffff;
    cursor: pointer;
  }
  .close-x {
    color: #94a3b8;
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    line-height: 1;
    padding: 2px 6px;
  }

  /* List */
  .notif-list {
    display: flex;
    flex-direction: column;
  }
  .notif-item {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 16px 20px;
    border-bottom: 1px solid #f1f5f9;
    background: #ffffff;
  }
  .notif-item:hover {
    background: #fafafa;
  }
  .item-logo {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #084048;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 18px;
    flex-shrink: 0;
    box-shadow: inset 0 0 4px rgba(0,0,0,0.3);
  }
  .item-content {
    flex: 1;
    min-width: 0;
  }
  .item-top-row {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px;
  }
  .item-id-title {
    font-size: 13px;
    font-weight: 800;
    color: #0f172a;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }
  .blue-pill {
    background: #258bd2;
    color: #ffffff;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 10px;
    border-radius: 12px;
    white-space: nowrap;
  }
  .item-body {
    font-size: 12px;
    color: #475569;
    margin-top: 5px;
    line-height: 1.4;
  }
  .item-date-green {
    font-size: 12px;
    font-weight: 700;
    color: #16a34a;
    margin-top: 5px;
  }
  .check-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1.5px solid #22c55e;
    background: #f0fdf4;
    color: #22c55e;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 900;
    flex-shrink: 0;
    cursor: pointer;
  }

  /* Footer */
  .notif-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-top: 1px solid #f1f5f9;
    background: #ffffff;
  }
  .footer-link {
    font-size: 13px;
    font-weight: 800;
    color: #1d4ed8;
    cursor: pointer;
    text-decoration: none;
  }
  .footer-link:hover {
    text-decoration: underline;
  }
</style>
</head>
<body>
  <div class="container">
    <!-- Top Bar Mock -->
    <div class="top-bar-mock">
      <div class="bell-btn">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        <div class="bell-badge">11</div>
      </div>
      <div class="user-chip">
        <div class="user-avatar">R</div>
        <div class="user-info">
          <span class="user-name">RAHEEL</span>
          <span class="user-sub">Role: Manager</span>
        </div>
        <span class="user-chevron">▼</span>
      </div>
    </div>

    <!-- Dropdown Modal -->
    <div class="notif-card">
      <div class="notif-header">
        <h3>Notifications</h3>
        <div class="header-actions">
          <div class="sound-pill">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
            Sound Off
          </div>
          <div class="close-x">✕</div>
        </div>
      </div>

      <div class="notif-list">
        <!-- Item 1: Zone 1 Alert -->
        <div class="notif-item">
          <div class="item-logo">a</div>
          <div class="item-content">
            <div class="item-top-row">
              <span class="item-id-title">ID: 1083 | VICKIE ENRIGHT</span>
              <span class="blue-pill">13 minutes ago at 01:19 AM GMT+5</span>
            </div>
            <div class="item-body">
              <b>ZONE 1 – EX-FACTORY DATE PASSED:</b> PO <b>PO-1083</b> is <span style="color:#e11d48; font-weight:700;">5 day(s) overdue</span> (Committed: 2026-09-13).<br/>
              <b>Delay Reason:</b> Fabric shortage | <b>CAPA:</b> Expedited air shipment | <b>Recovery Date:</b> 2026-09-25
            </div>
            <div class="item-date-green">09/09/2026, 05:00 AM GMT+5</div>
          </div>
          <div class="check-btn">✓</div>
        </div>

        <!-- Item 2: Zone 2 Alert -->
        <div class="notif-item">
          <div class="item-logo">a</div>
          <div class="item-content">
            <div class="item-top-row">
              <span class="item-id-title">ID: 1041 | RYSZARDA PATRONSKA</span>
              <span class="blue-pill">53 minutes ago at 12:38 AM GMT+5</span>
            </div>
            <div class="item-body">
              <b>ZONE 2 – PROCESS STAGE DELAYED:</b> PO stuck at <b>PP Sample</b> (<span style="color:#e11d48; font-weight:700;">3 day(s) overdue</span>).<br/>
              <b>Root Cause:</b> Pattern size spec revision | <b>CAPA:</b> Extra pattern maker assigned | <b>Revised Date:</b> 2026-09-22
            </div>
            <div class="item-date-green">08/31/2026, 05:00 AM GMT+5</div>
          </div>
          <div class="check-btn">✓</div>
        </div>

        <!-- Item 3: Order Created Alert -->
        <div class="notif-item">
          <div class="item-logo">a</div>
          <div class="item-content">
            <div class="item-top-row">
              <span class="item-id-title">ID: 1078 | ZAHIDA AZMAT</span>
              <span class="blue-pill">1 hour ago at 12:31 AM GMT+5</span>
            </div>
            <div class="item-body">
              <b>NEW SAMPLING ORDER CREATED:</b> PO <b>PO-1078</b> assigned to <b>SafeLife Tex</b>.<br/>
              Quantity: <b>500 pcs</b> | Ex-Factory Date: <b>2026-09-30</b> | Created by: <b>Raheel</b>
            </div>
            <div class="item-date-green">09/04/2026, 05:00 AM GMT+5</div>
          </div>
          <div class="check-btn">✓</div>
        </div>
      </div>

      <div class="notif-footer">
        <a class="footer-link">You have 11 notifications</a>
        <a class="footer-link">Mark All As Read</a>
      </div>
    </div>
  </div>
</body>
</html>
"""

HTML_CAPA_MODAL_75 = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  body {
    background: #e2e8f0;
    padding: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 540px;
  }
  .modal-card {
    width: 540px;
    background: #ffffff;
    border-radius: 24px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    overflow: hidden;
    padding: 24px;
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 16px;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .icon-box {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: #fff1f2;
    border: 1px solid #fecdd3;
    color: #e11d48;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .header-title {
    font-size: 15px;
    font-weight: 800;
    color: #0f172a;
  }
  .header-sub {
    font-size: 12px;
    color: #64748b;
  }
  .close-btn {
    color: #94a3b8;
    font-size: 18px;
    cursor: pointer;
  }
  .form-group {
    margin-top: 16px;
  }
  .form-label {
    display: block;
    font-size: 12px;
    font-weight: 800;
    color: #334155;
    margin-bottom: 6px;
  }
  .form-textarea {
    width: 100%;
    border-radius: 12px;
    border: 1px solid #cbd5e1;
    padding: 10px 12px;
    font-size: 12px;
    color: #1e293b;
    line-height: 1.4;
    outline: none;
    background: #f8fafc;
  }
  .form-input {
    width: 100%;
    border-radius: 12px;
    border: 1px solid #cbd5e1;
    padding: 10px 12px;
    font-size: 12px;
    color: #1e293b;
    outline: none;
    background: #f8fafc;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #f1f5f9;
  }
  .btn-cancel {
    border: 1px solid #cbd5e1;
    background: #ffffff;
    padding: 8px 16px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 700;
    color: #475569;
    cursor: pointer;
  }
  .btn-submit {
    background: #084048;
    color: #ffffff;
    border: none;
    padding: 8px 18px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(8, 64, 72, 0.25);
  }
</style>
</head>
<body>
  <div class="modal-card">
    <div class="modal-header">
      <div class="header-left">
        <div class="icon-box">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <div>
          <div class="header-title">ZONE 1: Document Delay Reason & Recovery</div>
          <div class="header-sub">PO: 1083 | VICKIE ENRIGHT — Ex-Factory 5 Days Overdue</div>
        </div>
      </div>
      <div class="close-btn">✕</div>
    </div>

    <div class="form-group">
      <label class="form-label">Delay Reason *</label>
      <div class="form-textarea">Fabric supplier faced yarn spinning bottleneck, delaying mill delivery by 5 calendar days.</div>
    </div>

    <div class="form-group">
      <label class="form-label">Corrective & Preventive Action (CAPA) *</label>
      <div class="form-textarea">Authorized expedited air courier delivery at vendor expense and allocated 2 dedicated sewing lines to compress timeline.</div>
    </div>

    <div class="form-group">
      <label class="form-label">Recovery Date *</label>
      <div class="form-input">2026-09-25</div>
    </div>

    <div class="modal-actions">
      <button class="btn-cancel">Cancel</button>
      <button class="btn-submit">Save & Update CAPA</button>
    </div>
  </div>
</body>
</html>
"""

def capture(html_str, out_png, win_size="800,740"):
    temp_html = os.path.join(DOCS_DIR, "temp_notif_render.html")
    with open(temp_html, "w", encoding="utf-8") as f:
        f.write(html_str)
    cmd = [
        CHROME_BIN,
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        f"--window-size={win_size}",
        f"--screenshot={out_png}",
        f"file://{temp_html}"
    ]
    subprocess.run(cmd, check=True)
    if os.path.exists(temp_html):
        os.remove(temp_html)
    print(f"Captured: {out_png} ({os.path.getsize(out_png)} bytes)")

if __name__ == "__main__":
    p74 = os.path.join(SCREENSHOTS_DIR, "74-notification-center-dropdown.png")
    p75 = os.path.join(SCREENSHOTS_DIR, "75-zone1-zone2-capa-documentation.png")

    capture(HTML_NOTIF_DROPDOWN_74, p74, "780,720")
    capture(HTML_CAPA_MODAL_75, p75, "680,540")
    print("Notification screenshots successfully generated!")
