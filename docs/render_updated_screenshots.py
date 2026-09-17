#!/usr/bin/env python3
"""
render_updated_screenshots.py
Renders updated screenshots for:
- 25-qc-modal-conditional.png (QC Decision modal with updated option 2 dropdown)
- 51-conditional-approval-modal.png (PP Sample Development conditional modal with option 2 selected)
- 45-merge-sla-dialog.png (SLA merge dialog with Target Days and Buffer Days)
- 46-merged-chunk-created.png (Merged Chunk card displaying Target SLA Days and +Buffer Days)
"""
import os
import subprocess

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))
SCREENSHOTS_DIR = os.path.join(DOCS_DIR, "screenshots")
CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# ─────────────────────────────────────────────────────────────────────────────
# 1. Screenshot 25: QC Decision — PPS QC Check with Dropdown Open
# ─────────────────────────────────────────────────────────────────────────────
HTML_QC_MODAL_25 = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  body {
    background: #eef2f6;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 24px;
  }
  .modal-card {
    background: #ffffff;
    width: 580px;
    border-radius: 24px;
    box-shadow: 0 20px 40px -8px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0,0,0,0.2);
    overflow: visible;
    position: relative;
    border: 1px solid rgba(226, 232, 240, 0.8);
  }
  .modal-header {
    padding: 22px 28px 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top-left-radius: 24px;
    border-top-right-radius: 24px;
    background: #f0fdf9;
  }
  .modal-title {
    font-size: 20px;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: -0.3px;
  }
  .close-btn {
    color: #64748b;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }
  .modal-body {
    padding: 24px 28px 26px;
  }
  .field-label {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: #334155;
    margin-bottom: 8px;
  }
  .select-box {
    width: 100%;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    padding: 12px 16px;
    font-size: 13.5px;
    font-weight: 700;
    color: #0f172a;
    background: #ffffff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
  }
  .select-arrow {
    width: 12px;
    height: 12px;
    border-left: 2px solid #64748b;
    border-bottom: 2px solid #64748b;
    transform: rotate(-45deg);
    margin-top: -4px;
  }
  .dropdown-menu {
    position: absolute;
    top: 52px;
    left: 0;
    right: 0;
    background: #334155;
    border-radius: 14px;
    box-shadow: 0 14px 30px rgba(15, 23, 42, 0.35);
    padding: 8px;
    z-index: 50;
    color: #f8fafc;
  }
  .dropdown-item {
    padding: 9px 14px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dropdown-item.active {
    background: rgba(255, 255, 255, 0.12);
    font-weight: 700;
  }
  .dropdown-item.highlight {
    background: #475569;
    color: #ffffff;
  }
  .warning-banner {
    margin-top: 175px;
    background: #fffbeb;
    border: 1px solid #fef3c7;
    border-radius: 14px;
    padding: 16px 18px;
  }
  .warning-title {
    font-size: 13.5px;
    font-weight: 800;
    color: #b45309;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .warning-desc {
    font-size: 12.5px;
    font-weight: 500;
    color: #92400e;
    line-height: 1.5;
  }
  .actions {
    margin-top: 24px;
    display: flex;
    justify-content: flex-end;
    gap: 14px;
  }
  .btn-cancel {
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
    border-radius: 12px;
    padding: 12px 24px;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #334155;
  }
  .btn-confirm {
    background: #f59e0b;
    border: none;
    border-radius: 12px;
    padding: 12px 24px;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #ffffff;
    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);
  }
</style>
</head>
<body>
  <div class="modal-card">
    <div class="modal-header">
      <div class="modal-title">QC Decision — PPS QC Check</div>
      <div class="close-btn">✕</div>
    </div>
    <div class="modal-body">
      <div class="field-label">Conditional Requirement</div>
      <div class="select-box">
        <span>Select conditional defect requirement...</span>
        <div class="select-arrow"></div>
        
        <div class="dropdown-menu">
          <div class="dropdown-item active">✓ Select conditional defect requirement...</div>
          <div class="dropdown-item">1. Fabric shade / resubmission before bulk fabric dying (Blocks Bulk Dyeing)</div>
          <div class="dropdown-item highlight">2. If size specs are incorrect then need to submit fit sample (Blocks Bulk Cutting)</div>
          <div class="dropdown-item">3. Embellishment printing or embroidery strike off (Blocks Bulk Embellishment)</div>
          <div class="dropdown-item">Other — see remarks</div>
        </div>
      </div>

      <div class="warning-banner">
        <div class="warning-title">⚠️ Conditional Approval: The selected condition will place a mandatory defect gate on downstream production.</div>
        <div class="warning-desc">The blocked downstream stage cannot be started or completed until an authorized user uploads a proof attachment and submits clearance notes.</div>
      </div>

      <div class="actions">
        <button class="btn-cancel">Cancel</button>
        <button class="btn-confirm">Confirm Conditional Approved</button>
      </div>
    </div>
  </div>
</body>
</html>
"""

# ─────────────────────────────────────────────────────────────────────────────
# 2. Screenshot 51: QC Decision — PP Sample Development (Option 2 Selected)
# ─────────────────────────────────────────────────────────────────────────────
HTML_QC_MODAL_51 = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  body {
    background: #eef2f6;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 24px;
  }
  .modal-card {
    background: #ffffff;
    width: 580px;
    border-radius: 24px;
    box-shadow: 0 20px 40px -8px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0,0,0,0.2);
    position: relative;
    border: 1px solid rgba(226, 232, 240, 0.8);
  }
  .modal-header {
    padding: 22px 28px 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top-left-radius: 24px;
    border-top-right-radius: 24px;
    background: #f0fdf9;
  }
  .modal-title {
    font-size: 20px;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: -0.3px;
  }
  .close-btn {
    color: #64748b;
    font-size: 18px;
    cursor: pointer;
  }
  .modal-body {
    padding: 24px 28px 26px;
  }
  .field-label {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: #334155;
    margin-bottom: 8px;
  }
  .select-box {
    width: 100%;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    padding: 13px 16px;
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    background: #ffffff;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .select-arrow {
    width: 10px;
    height: 10px;
    border-left: 2px solid #64748b;
    border-bottom: 2px solid #64748b;
    transform: rotate(-45deg);
    margin-top: -4px;
  }
  .warning-banner {
    margin-top: 20px;
    background: #fffbeb;
    border: 1px solid #fef3c7;
    border-radius: 14px;
    padding: 16px 18px;
  }
  .warning-title {
    font-size: 13.5px;
    font-weight: 800;
    color: #b45309;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .warning-desc {
    font-size: 12.5px;
    font-weight: 500;
    color: #92400e;
    line-height: 1.5;
  }
  .actions {
    margin-top: 26px;
    display: flex;
    justify-content: flex-end;
    gap: 14px;
  }
  .btn-cancel {
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
    border-radius: 12px;
    padding: 12px 24px;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #334155;
  }
  .btn-confirm {
    background: #ea580c;
    border: none;
    border-radius: 12px;
    padding: 12px 24px;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #ffffff;
    box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);
  }
</style>
</head>
<body>
  <div class="modal-card">
    <div class="modal-header">
      <div class="modal-title">QC Decision — PP Sample Development</div>
      <div class="close-btn">✕</div>
    </div>
    <div class="modal-body">
      <div class="field-label">Conditional Requirement</div>
      <div class="select-box">
        <span>2. If size specs are incorrect then need to submit fit sample (Blocks Bulk Cutting)</span>
        <div class="select-arrow"></div>
      </div>

      <div class="warning-banner">
        <div class="warning-title">⚠️ Conditional Approval: The selected condition will place a mandatory defect gate on downstream production.</div>
        <div class="warning-desc">The blocked downstream stage cannot be started or completed until an authorized user uploads a proof attachment and submits clearance notes.</div>
      </div>

      <div class="actions">
        <button class="btn-cancel">Cancel</button>
        <button class="btn-confirm">Confirm Conditional Approved</button>
      </div>
    </div>
  </div>
</body>
</html>
"""

# ─────────────────────────────────────────────────────────────────────────────
# 3. Screenshot 45: Combine Stages into Single SLA (Target Days + Buffer Days)
# ─────────────────────────────────────────────────────────────────────────────
HTML_CHUNK_MODAL_45 = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body {
    background: #f8fafc;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 24px;
  }
  .dialog-card {
    background: #ffffff;
    width: 500px;
    border-radius: 28px;
    box-shadow: 0 24px 50px -12px rgba(0, 0, 0, 0.18);
    border: 1px solid #e2e8f0;
    padding: 36px 36px 32px;
    text-align: center;
  }
  .dialog-title {
    font-size: 22px;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: -0.2px;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .dialog-subtitle {
    font-size: 12px;
    font-weight: 800;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-bottom: 28px;
  }
  .grid-days {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 30px;
  }
  .input-box {
    background: #f8fafc;
    border: 1.5px solid #e2e8f0;
    border-radius: 18px;
    padding: 16px 14px 14px;
    text-align: center;
  }
  .input-label {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: #6366f1;
    margin-bottom: 8px;
    display: block;
  }
  .input-label.amber {
    color: #d97706;
  }
  .number-val {
    font-size: 26px;
    font-weight: 900;
    color: #0f172a;
    width: 100%;
    text-align: center;
    background: transparent;
    border: none;
    outline: none;
  }
  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .btn-cancel {
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
    border-radius: 16px;
    padding: 14px;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: #64748b;
  }
  .btn-confirm {
    background: #10b981;
    border: none;
    border-radius: 16px;
    padding: 14px;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: #ffffff;
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);
  }
</style>
</head>
<body>
  <div class="dialog-card">
    <div class="dialog-title">Set SLA & Buffer Days</div>
    <div class="dialog-subtitle">Grouping: Pressing to Finishing</div>

    <div class="grid-days">
      <div class="input-box">
        <span class="input-label">Total Target Days</span>
        <div class="number-val">3</div>
      </div>
      <div class="input-box" style="border-color: #fde68a; background: #fffbeb;">
        <span class="input-label amber">+Buffer Days (Contingency)</span>
        <div class="number-val" style="color: #b45309;">1</div>
      </div>
    </div>

    <div class="actions">
      <button class="btn-cancel">Cancel</button>
      <button class="btn-confirm">Confirm</button>
    </div>
  </div>
</body>
</html>
"""

# ─────────────────────────────────────────────────────────────────────────────
# 4. Screenshot 46: Merged Chunk Created with Target Days & Buffer Days
# ─────────────────────────────────────────────────────────────────────────────
HTML_CHUNK_CARD_46 = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body {
    background: #f0fdf4;
    display: flex;
    justify-content: center;
    padding: 24px;
  }
  .outer-panel {
    background: #ffffff;
    border: 1px solid #d1fae5;
    border-radius: 28px;
    width: 480px;
    padding: 26px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 900;
    font-style: italic;
    text-transform: uppercase;
    color: #065f46;
    margin-bottom: 8px;
  }
  .section-desc {
    font-size: 11px;
    font-weight: 800;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1.4;
    margin-bottom: 20px;
  }
  .chunk-heading {
    font-size: 11px;
    font-weight: 900;
    font-style: italic;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 12px;
  }
  .chunk-box {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 22px;
    padding: 20px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.04);
    margin-bottom: 24px;
  }
  .chunk-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }
  .chunk-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #10b981;
  }
  .chunk-title {
    font-size: 14px;
    font-weight: 900;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .chunk-subtitle {
    font-size: 11px;
    font-weight: 800;
    color: #64748b;
    text-transform: uppercase;
    margin-top: 2px;
  }
  .btn-unmerge {
    background: #fee2e2;
    border: 1px solid #fecaca;
    color: #ef4444;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 6px 14px;
    border-radius: 12px;
  }
  .chunk-days-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  .sla-cell {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .sla-label {
    font-size: 10.5px;
    font-weight: 900;
    color: #6366f1;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .sla-label.amber {
    color: #d97706;
  }
  .sla-input-badge {
    background: #ffffff;
    border: 1.5px solid #cbd5e1;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 900;
    color: #0f172a;
    padding: 4px 10px;
    text-align: center;
    width: 44px;
  }
  .sla-input-badge.amber {
    border-color: #fde68a;
    color: #b45309;
    background: #fffbeb;
  }
  .stage-tags {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-left: 6px;
  }
  .stage-tag-item {
    font-size: 11.5px;
    font-weight: 800;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .stage-tag-bullet {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #64748b;
  }
  .available-heading {
    font-size: 11px;
    font-weight: 900;
    font-style: italic;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 12px;
  }
  .stage-row {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .stage-row-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .chk {
    width: 16px;
    height: 16px;
    border: 1.5px solid #94a3b8;
    border-radius: 4px;
  }
  .stage-row-title {
    font-size: 12px;
    font-weight: 900;
    color: #0f172a;
    text-transform: uppercase;
  }
  .stage-row-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pill {
    background: #ffffff;
    border: 1.5px solid #cbd5e1;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 900;
    padding: 4px 8px;
    color: #10b981;
  }
</style>
</head>
<body>
  <div class="outer-panel">
    <div class="section-header">
      <span style="font-size: 16px;">+</span> PREDICTED STAGE DAYS (SLA GROUPING ENABLED)
    </div>
    <div class="section-desc">
      SELECT MULTIPLE STAGES TO MERGE THEM UNDER A COMBINED SLA CHUNK, OR ASSIGN DAYS INDIVIDUALLY.
    </div>

    <div class="chunk-heading">MERGED CHUNKS</div>
    <div class="chunk-box">
      <div class="chunk-top">
        <div class="chunk-info">
          <div class="dot"></div>
          <div>
            <div class="chunk-title">PRESSING TO FINISHING</div>
            <div class="chunk-subtitle">2 STAGES MERGED</div>
          </div>
        </div>
        <button class="btn-unmerge">UNMERGE</button>
      </div>

      <div class="chunk-days-grid">
        <div class="sla-cell">
          <span class="sla-label">TOTAL SLA</span>
          <div class="sla-input-badge">4</div>
        </div>
        <div class="sla-cell" style="border-left: 1px solid #e2e8f0; padding-left: 12px;">
          <span class="sla-label amber">+BUFFER</span>
          <div class="sla-input-badge amber">1</div>
        </div>
      </div>

      <div class="stage-tags">
        <div class="stage-tag-item"><span class="stage-tag-bullet"></span> PRESSING</div>
        <div class="stage-tag-item"><span class="stage-tag-bullet"></span> FINISHING</div>
      </div>
    </div>

    <div class="available-heading">INDIVIDUAL & AVAILABLE STAGES</div>
    <div class="stage-row">
      <div class="stage-row-left">
        <div class="chk"></div>
        <div class="stage-row-title">1. CUSTOMER ORDER...</div>
      </div>
      <div class="stage-row-right">
        <div class="pill">1</div>
        <div class="pill" style="color: #b45309; border-color: #fde68a; background: #fffbeb;">0</div>
      </div>
    </div>
  </div>
</body>
</html>
"""

def capture(html_str, out_png, win_size="700,600"):
    temp_html = os.path.join(DOCS_DIR, "temp_render.html")
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
    p25 = os.path.join(SCREENSHOTS_DIR, "25-qc-modal-conditional.png")
    p51 = os.path.join(SCREENSHOTS_DIR, "51-conditional-approval-modal.png")
    p45 = os.path.join(SCREENSHOTS_DIR, "45-merge-sla-dialog.png")
    p46 = os.path.join(SCREENSHOTS_DIR, "46-merged-chunk-created.png")

    capture(HTML_QC_MODAL_25, p25, "650,560")
    capture(HTML_QC_MODAL_51, p51, "650,420")
    capture(HTML_CHUNK_MODAL_45, p45, "550,330")
    capture(HTML_CHUNK_CARD_46, p46, "530,520")
    print("All screenshots successfully rendered and saved!")
