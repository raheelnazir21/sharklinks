#!/usr/bin/env python3
"""
Render pixel-perfect screenshots of the new Excel (.xlsx) export features for the handbook.
Uses headless Google Chrome to render modern, high-DPI screenshots.
"""
import os
import subprocess

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))
SCREENSHOTS_DIR = os.path.join(DOCS_DIR, "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# 1. Screenshot 71: Toolbar with Export Excel (.xlsx) and Export CSV buttons
HTML_TOOLBAR = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { background: #f1f5f9; padding: 30px; display: flex; justify-content: center; }
  .toolbar-container {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    box-shadow: 0 4px 20px -2px rgba(0,0,0,0.05);
    padding: 16px 20px;
    width: 1000px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .search-box {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 10px 16px;
    flex: 1;
    color: #94a3b8;
    font-size: 14px;
  }
  .search-icon { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; }
  .actions { display: flex; align-items: center; gap: 10px; }
  .filter-select {
    padding: 10px 16px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    font-size: 14px;
    font-weight: 600;
    color: #334155;
  }
  .btn-excel {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    color: #065f46;
    font-size: 13.5px;
    font-weight: 700;
    padding: 11px 18px;
    border-radius: 12px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  }
  .btn-csv {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    color: #334155;
    font-size: 13.5px;
    font-weight: 700;
    padding: 11px 16px;
    border-radius: 12px;
  }
  .btn-primary {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #0284c7;
    color: #ffffff;
    font-size: 13.5px;
    font-weight: 700;
    padding: 11px 18px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);
  }
  .icon { width: 16px; height: 16px; stroke-width: 2.2; }
  .badge {
    background: #10b981;
    color: white;
    font-size: 10px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 6px;
    text-transform: uppercase;
    margin-left: 2px;
  }
</style>
</head>
<body>
  <div class="toolbar-container">
    <div class="search-box">
      <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      <span>Search sample classes, customer, serial number...</span>
    </div>
    <div class="actions">
      <select class="filter-select">
        <option>All Status</option>
      </select>
      <button class="btn-excel">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#059669"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
        Export Excel (.xlsx) <span class="badge">Multi-Tab</span>
      </button>
      <button class="btn-csv">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#0891b2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Export CSV
      </button>
      <button class="btn-primary">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        New Sample
      </button>
    </div>
  </div>
</body>
</html>
"""

# 2. Screenshot 72: Excel Master Sheet (Multi-Tab at bottom, professional slate colors)
HTML_EXCEL_MASTER = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif; }
  body { background: #e2e8f0; padding: 24px; }
  .excel-window {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.12);
    overflow: hidden;
  }
  .excel-top-bar {
    background: #107c41; /* Microsoft Excel Green */
    color: white;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .excel-sheet-header {
    padding: 20px 24px 14px 24px;
    background: #ffffff;
    border-bottom: 2px solid #e2e8f0;
  }
  .doc-title { font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px; }
  .doc-sub { font-size: 12px; color: #64748b; margin-top: 4px; font-style: italic; }
  
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th {
    background: #1e293b;
    color: #ffffff;
    font-weight: 700;
    padding: 10px 12px;
    text-align: left;
    border: 1px solid #334155;
    font-size: 11.5px;
    letter-spacing: 0.2px;
  }
  th.center { text-align: center; }
  th.right { text-align: right; }
  td {
    padding: 9px 12px;
    border: 1px solid #e2e8f0;
    color: #1e293b;
    white-space: nowrap;
  }
  tr.even { background: #f8fafc; }
  td.center { text-align: center; }
  td.right { text-align: right; font-variant-numeric: tabular-nums; }
  
  .badge-prog { background: #e0f2fe; color: #0369a1; font-weight: 700; padding: 3px 8px; border-radius: 6px; font-size: 11px; }
  .badge-done { background: #dcfce7; color: #15803d; font-weight: 700; padding: 3px 8px; border-radius: 6px; font-size: 11px; }
  .badge-delay { background: #fee2e2; color: #b91c1c; font-weight: 800; padding: 3px 8px; border-radius: 6px; font-size: 11px; }
  .link-tab { color: #2563eb; text-decoration: underline; font-weight: 600; cursor: pointer; }
  
  /* Sheet Tabs Bar at bottom */
  .excel-tabs-bar {
    background: #f1f5f9;
    border-top: 1px solid #cbd5e1;
    padding: 6px 12px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .tab-btn {
    padding: 6px 16px;
    font-size: 12px;
    border: 1px solid #cbd5e1;
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    color: #475569;
    background: #e2e8f0;
    font-weight: 600;
  }
  .tab-btn.active {
    background: #ffffff;
    color: #0f172a;
    font-weight: 700;
    border-top: 3px solid #107c41;
  }
</style>
</head>
<body>
  <div class="excel-window">
    <div class="excel-top-bar">
      <span>AutoSave ON &nbsp;|&nbsp; 📄 sample-classes-wip-2026-09-17.xlsx - Excel</span>
      <span>Executive Multi-Sheet Export</span>
    </div>
    
    <div class="excel-sheet-header">
      <div class="doc-title">FACTORY PRODUCTION WORK-IN-PROGRESS (WIP) — SAMPLE CLASSES</div>
      <div class="doc-sub">Multi-Class Master Production Schedule & Pipeline Status | Generated 2026-09-17</div>
    </div>
    
    <table>
      <thead>
        <tr>
          <th class="center">Serial</th>
          <th>Class Name</th>
          <th>Customer</th>
          <th>Vendor</th>
          <th>Product Name</th>
          <th>Style Code</th>
          <th>PO #</th>
          <th class="right">Qty</th>
          <th>Current Active Stage</th>
          <th class="center">Status</th>
          <th class="center">Target Date</th>
          <th class="center">Progress</th>
          <th class="center">Ex-Factory</th>
          <th class="center">Delivery Status</th>
          <th class="center">Class Sheet</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="center"><strong>SC-001</strong></td>
          <td>Summer 2026 Collection</td>
          <td>Nike</td>
          <td>Sunrise Mills</td>
          <td><strong>Men's Performance Polo</strong></td>
          <td>NK-PL-01</td>
          <td>PO-8841</td>
          <td class="right">2,500</td>
          <td>Stitching</td>
          <td class="center"><span class="badge-prog">in_progress</span></td>
          <td class="center">2026-09-24</td>
          <td class="center">4/8 (50%)</td>
          <td class="center">2026-10-05</td>
          <td class="center">18 days left</td>
          <td class="center"><span class="link-tab">SC-001 ➔</span></td>
        </tr>
        <tr class="even">
          <td class="center"><strong>SC-001</strong></td>
          <td>Summer 2026 Collection</td>
          <td>Nike</td>
          <td>Sunrise Mills</td>
          <td><strong>Women's Dri-Fit Tank</strong></td>
          <td>NK-TK-02</td>
          <td>PO-8842</td>
          <td class="right">1,800</td>
          <td>Cutting</td>
          <td class="center"><span class="badge-done">completed</span></td>
          <td class="center">2026-09-20</td>
          <td class="center">3/8 (38%)</td>
          <td class="center">2026-09-30</td>
          <td class="center">13 days left</td>
          <td class="center"><span class="link-tab">SC-001 ➔</span></td>
        </tr>
        <tr>
          <td class="center"><strong>SC-002</strong></td>
          <td>College Campus Series</td>
          <td>Pacsun</td>
          <td>Apex Textile</td>
          <td><strong>Oversized Fleece Hoodie</strong></td>
          <td>PS-HD-10</td>
          <td>PO-9104</td>
          <td class="right">4,000</td>
          <td>Fabric Sourcing</td>
          <td class="center"><span class="badge-delay">delayed</span></td>
          <td class="center">2026-09-14</td>
          <td class="center">1/6 (17%)</td>
          <td class="center">2026-10-15</td>
          <td class="center"><span class="badge-delay">3d DELAYED</span></td>
          <td class="center"><span class="link-tab">SC-002 ➔</span></td>
        </tr>
        <tr class="even">
          <td class="center"><strong>SC-002</strong></td>
          <td>College Campus Series</td>
          <td>Pacsun</td>
          <td>Apex Textile</td>
          <td><strong>Relaxed Vintage Tee</strong></td>
          <td>PS-TE-11</td>
          <td>PO-9105</td>
          <td class="right">6,500</td>
          <td>Stitching</td>
          <td class="center"><span class="badge-prog">in_progress</span></td>
          <td class="center">2026-09-23</td>
          <td class="center">4/6 (67%)</td>
          <td class="center">2026-10-02</td>
          <td class="center">15 days left</td>
          <td class="center"><span class="link-tab">SC-002 ➔</span></td>
        </tr>
        <tr>
          <td class="center"><strong>SC-002</strong></td>
          <td>College Campus Series</td>
          <td>Pacsun</td>
          <td>Apex Textile</td>
          <td><strong>Skate Cargo Pants</strong></td>
          <td>PS-CG-12</td>
          <td>PO-9106</td>
          <td class="right">2,000</td>
          <td>Sample Completed</td>
          <td class="center"><span class="badge-done">completed</span></td>
          <td class="center">2026-09-18</td>
          <td class="center">6/6 (100%)</td>
          <td class="center">2026-09-28</td>
          <td class="center"><span class="badge-done">Ready</span></td>
          <td class="center"><span class="link-tab">SC-002 ➔</span></td>
        </tr>
      </tbody>
    </table>
    
    <div class="excel-tabs-bar">
      <div class="tab-btn active">Master Overview</div>
      <div class="tab-btn">SC-001 - Summer 2026</div>
      <div class="tab-btn">SC-002 - College Campus</div>
      <div class="tab-btn">BP-001 - Winter Outerwear</div>
      <div class="tab-btn">BP-002 - Denim Series</div>
    </div>
  </div>
</body>
</html>
"""

# 3. Screenshot 73: Individual Class Tab inside Excel (Banner + Metadata Card + Stages)
HTML_EXCEL_CLASS = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif; }
  body { background: #e2e8f0; padding: 24px; }
  .excel-window {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.12);
    overflow: hidden;
  }
  .excel-top-bar {
    background: #107c41;
    color: white;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
  }
  .class-banner {
    background: #0f766e; /* Executive Teal */
    color: #ffffff;
    padding: 16px 24px;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.3px;
  }
  .meta-card {
    background: #f8fafc;
    border-bottom: 2px solid #e2e8f0;
    padding: 14px 24px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    row-gap: 8px;
    font-size: 12px;
  }
  .meta-item { display: flex; gap: 8px; }
  .meta-lbl { font-weight: 700; color: #475569; width: 110px; }
  .meta-val { font-weight: 700; color: #0f172a; }
  .meta-link { color: #2563eb; text-decoration: underline; font-weight: 600; cursor: pointer; }
  
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th {
    background: #1e293b;
    color: #ffffff;
    font-weight: 700;
    padding: 10px 12px;
    text-align: left;
    border: 1px solid #334155;
    font-size: 11.5px;
  }
  th.center { text-align: center; }
  th.right { text-align: right; }
  td {
    padding: 9px 12px;
    border: 1px solid #e2e8f0;
    color: #1e293b;
    white-space: nowrap;
  }
  tr.even { background: #f8fafc; }
  td.center { text-align: center; }
  td.right { text-align: right; font-variant-numeric: tabular-nums; }
  
  .badge-prog { background: #e0f2fe; color: #0369a1; font-weight: 700; padding: 3px 8px; border-radius: 6px; font-size: 11px; }
  .badge-done { background: #dcfce7; color: #15803d; font-weight: 700; padding: 3px 8px; border-radius: 6px; font-size: 11px; }
  
  .excel-tabs-bar {
    background: #f1f5f9;
    border-top: 1px solid #cbd5e1;
    padding: 6px 12px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .tab-btn {
    padding: 6px 16px;
    font-size: 12px;
    border: 1px solid #cbd5e1;
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    color: #475569;
    background: #e2e8f0;
    font-weight: 600;
  }
  .tab-btn.active {
    background: #ffffff;
    color: #0f172a;
    font-weight: 700;
    border-top: 3px solid #107c41;
  }
</style>
</head>
<body>
  <div class="excel-window">
    <div class="excel-top-bar">
      <span>AutoSave ON &nbsp;|&nbsp; 📄 sample-classes-wip-2026-09-17.xlsx - Excel</span>
    </div>
    
    <div class="class-banner">
      PROJECT DETAILS: [SC-001] SUMMER 2026 COLLECTION
    </div>
    
    <div class="meta-card">
      <div class="meta-item"><span class="meta-lbl">Customer:</span><span class="meta-val">Nike</span></div>
      <div class="meta-item"><span class="meta-lbl">Assigned Vendor:</span><span class="meta-val">Sunrise Mills</span></div>
      <div class="meta-item"><span class="meta-lbl">Class Status:</span><span class="meta-val">ACTIVE</span></div>
      <div class="meta-item"><span class="meta-lbl">Active Styles:</span><span class="meta-val">3 Styles</span></div>
      <div class="meta-item"><span class="meta-lbl">Total Quantity:</span><span class="meta-val">7,500 Units</span></div>
      <div class="meta-item"><span class="meta-lbl">Navigation:</span><span class="meta-link">← Return to Master Overview</span></div>
    </div>
    
    <table>
      <thead>
        <tr>
          <th class="center">#</th>
          <th>Product Name</th>
          <th>Style Code</th>
          <th>PO #</th>
          <th class="right">Quantity</th>
          <th>Current Active Stage</th>
          <th class="center">Stage Status</th>
          <th class="center">Target Date</th>
          <th class="center">Progress</th>
          <th class="center">Ex-Factory</th>
          <th class="center">Delivery Status</th>
          <th>Latest Stage Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="center">1</td>
          <td><strong>Men's Performance Polo</strong></td>
          <td>NK-PL-01</td>
          <td>PO-8841</td>
          <td class="right">2,500</td>
          <td>Stitching</td>
          <td class="center"><span class="badge-prog">in_progress</span></td>
          <td class="center">2026-09-24</td>
          <td class="center">4/8 (50%)</td>
          <td class="center">2026-10-05</td>
          <td class="center">18 days left</td>
          <td>Sleeves joined; collar placket underway</td>
        </tr>
        <tr class="even">
          <td class="center">2</td>
          <td><strong>Women's Dri-Fit Tank</strong></td>
          <td>NK-TK-02</td>
          <td>PO-8842</td>
          <td class="right">1,800</td>
          <td>Cutting</td>
          <td class="center"><span class="badge-done">completed</span></td>
          <td class="center">2026-09-20</td>
          <td class="center">3/8 (38%)</td>
          <td class="center">2026-09-30</td>
          <td class="center">13 days left</td>
          <td>Cutting completed; bundle dispatched to sewing</td>
        </tr>
        <tr>
          <td class="center">3</td>
          <td><strong>Kids Lightweight Short</strong></td>
          <td>NK-SH-03</td>
          <td>PO-8843</td>
          <td class="right">3,200</td>
          <td>Embellishment / Print</td>
          <td class="center"><span class="badge-prog">in_progress</span></td>
          <td class="center">2026-09-22</td>
          <td class="center">3/8 (38%)</td>
          <td class="center">2026-10-08</td>
          <td class="center">21 days left</td>
          <td>Screen print chest graphic 2nd color run</td>
        </tr>
      </tbody>
    </table>
    
    <div class="excel-tabs-bar">
      <div class="tab-btn">Master Overview</div>
      <div class="tab-btn active">SC-001 - Summer 2026</div>
      <div class="tab-btn">SC-002 - College Campus</div>
      <div class="tab-btn">BP-001 - Winter Outerwear</div>
      <div class="tab-btn">BP-002 - Denim Series</div>
    </div>
  </div>
</body>
</html>
"""

def capture_screenshot(html_content, output_png, window_size="1100,500"):
    temp_html = os.path.join(DOCS_DIR, "temp_render.html")
    with open(temp_html, "w", encoding="utf-8") as f:
        f.write(html_content)
        
    cmd = [
        CHROME_BIN,
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        f"--window-size={window_size}",
        f"--screenshot={output_png}",
        f"file://{temp_html}"
    ]
    subprocess.run(cmd, check=True)
    if os.path.exists(temp_html):
        os.remove(temp_html)
    print(f"Captured: {output_png} ({os.path.getsize(output_png)} bytes)")

if __name__ == "__main__":
    p71 = os.path.join(SCREENSHOTS_DIR, "71-excel-export-toolbar.png")
    p72 = os.path.join(SCREENSHOTS_DIR, "72-excel-export-master-sheet.png")
    p73 = os.path.join(SCREENSHOTS_DIR, "73-excel-export-class-tab.png")
    
    capture_screenshot(HTML_TOOLBAR, p71, "1050,130")
    capture_screenshot(HTML_EXCEL_MASTER, p72, "1150,420")
    capture_screenshot(HTML_EXCEL_CLASS, p73, "1150,380")
    print("All 3 screenshots rendered successfully!")
