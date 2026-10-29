"""
Multi-Factory & Factory-Isolated 6 Control Zones Excel Workbook Builder
Generates executive-ready, multi-tab Excel (.xlsx) reports:

1. Factory-Isolated Workbook (`build_factory_isolated_6_zones_workbook`):
   - Contains ONLY the specific factory's data (100% confidential).
   - Tab 1: Factory Master Rollup (all orders with KPIs)
   - Tab 2: Zone 1 - Ex-Factory Overdue (with CAPA & recovery requirements)
   - Tab 3: Zone 2 - Stage Delayed (with root cause requirements)
   - Tab 4: Zone 3 - Ex-Factory Approaching (within 7 days)
   - Tab 5: Zone 4 - Ready for Final QC Inspection
   - Tab 6: Zone 5 - QC Rejected / Rework Protocol
   - Tab 7: Zone 6 - QC Passed / Cleared for Dispatch
   - Dynamic =HYPERLINK("mailto:...") links to escalate directly to the manager.
   - Dynamic =HYPERLINK("https://textileapperal.com/orders/...") links to live PO portal.

2. Multi-Factory Rollup Workbook (`build_multi_factory_6_zones_workbook`):
   - Master sheet for executive leadership with all factories and tabs.
"""
import io
import urllib.parse
from datetime import date, timedelta
from typing import List, Dict, Any

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from app.core.config import settings
from app.models.order import Order, OrderStatus, StageStatus


# ─── Brand Styling Colors ──────────────────────────────────────────────────
NAVY_HEADER = "0F172A"
TEAL_ACCENT = "0284C7"
BORDER_GRAY = "E2E8F0"

ZONE_STYLES = {
    1: {"name": "ZONE 1: EX-FACTORY DATE PASSED", "color": "DC2626", "bg": "FEE2E2", "badge": "🚨 OVERDUE"},
    2: {"name": "ZONE 2: STAGE DELAYED", "color": "EA580C", "bg": "FFEDD5", "badge": "⏱️ STAGE DELAY"},
    3: {"name": "ZONE 3: EX-FACTORY APPROACHING (7 DAYS)", "color": "D97706", "bg": "FEF3C7", "badge": "⚡ IMMINENT DUE"},
    4: {"name": "ZONE 4: READY FOR FINAL QC", "color": "0284C7", "bg": "E0F2FE", "badge": "🔍 IN FINAL QC"},
    5: {"name": "ZONE 5: QC REJECTED / REWORK REQUIRED", "color": "7C3AED", "bg": "F3E8FF", "badge": "⚠️ REWORK PROTOCOL"},
    6: {"name": "ZONE 6: QC PASSED / READY FOR DISPATCH", "color": "16A34A", "bg": "DCFCE7", "badge": "✅ CLEARED SHIPMENT"},
}

THIN_BORDER = Border(
    left=Side(style="thin", color=BORDER_GRAY),
    right=Side(style="thin", color=BORDER_GRAY),
    top=Side(style="thin", color=BORDER_GRAY),
    bottom=Side(style="thin", color=BORDER_GRAY),
)


def _format_mailto_link(
    manager_email: str, 
    manager_name: str, 
    order_no: str, 
    zone_name: str, 
    delay_info: str,
    cc_emails: List[str] = None
) -> str:
    if not manager_email or "@" not in manager_email:
        manager_email = "qc@cottoncollective.org"
    
    subject = f"[Cotton Collective] Urgent Status Directive: PO #{order_no} ({zone_name})"
    body = (
        f"Dear {manager_name or 'Factory Production Manager'},\n\n"
        f"Regarding PO #{order_no} currently classified under {zone_name}:\n"
        f"Current Metric / Status: {delay_info}\n\n"
        f"Please provide an immediate update on the production status, allocated CAPA, and revised completion commitment.\n\n"
        f"Access live WIP dashboard: https://textileapperal.com/tracking-dashboard\n\n"
        f"Best regards,\nCotton Collective Executive Operations"
    )
    encoded_subj = urllib.parse.quote(subject)
    encoded_body = urllib.parse.quote(body)
    
    mailto_url = f"mailto:{manager_email}?subject={encoded_subj}&body={encoded_body}"
    if cc_emails:
        valid_ccs = [c.strip() for c in cc_emails if c and "@" in c and c != manager_email]
        if valid_ccs:
            mailto_url += f"&cc={urllib.parse.quote(','.join(valid_ccs))}"
    return mailto_url


def classify_order_zone(o: Order, today: date) -> int:
    """Accurately classifies an order into Zone 1 through 6."""
    if o.status == OrderStatus.completed:
        return 6
    if o.ex_factory_date and o.ex_factory_date < today:
        return 1
    # Check if in QC check stage
    for s in o.stages:
        val = s.stage_name.value if hasattr(s.stage_name, "value") else str(s.stage_name)
        if val in ("final_random_inspection", "final_random_qa_audit", "qc_check") and s.status != StageStatus.completed:
            return 4
    # Check if approaching in next 7 days
    if o.ex_factory_date and today <= o.ex_factory_date <= today + timedelta(days=7):
        return 3
    # Check if any stage is delayed
    for s in o.stages:
        if s.status not in (StageStatus.completed, StageStatus.skipped) and s.target_date:
            st = s.target_date.date() if hasattr(s.target_date, "date") else s.target_date
            if st < today:
                return 2
    return 2


# ─── 1. FACTORY ISOLATED WORKBOOK (FOR SPECIFIC FACTORY ONLY) ───────────────

def build_factory_isolated_6_zones_workbook(
    factory_name: str,
    factory_orders: List[Order],
    manager_name: str,
    manager_email: str,
    cc_emails: List[str] = None,
) -> io.BytesIO:
    """
    Builds a strictly isolated Excel dossier containing ONLY the data
    belonging to the given factory. Competitor/other vendor data is completely excluded.
    """
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # Remove default sheet

    today = date.today()
    base_url = getattr(settings, "APP_BASE_URL", "https://textileapperal.com").rstrip("/")
    if "localhost" in base_url:
        base_url = "https://textileapperal.com"

    # Filter active orders for this factory
    active_orders = [o for o in factory_orders if o.is_active and o.status != OrderStatus.cancelled]

    # Categorize into the 6 zones
    zones_map: Dict[int, List[Order]] = {z: [] for z in range(1, 7)}
    for o in active_orders:
        z_idx = classify_order_zone(o, today)
        zones_map[z_idx].append(o)

    # ── TAB 1: FACTORY MASTER OVERVIEW ──
    ws_main = wb.create_sheet(title="Factory Overview")
    ws_main.views.sheetView[0].showGridLines = True

    # Title Banner
    ws_main.merge_cells("A1:J1")
    t_cell = ws_main["A1"]
    t_cell.value = f"COTTON COLLECTIVE • {factory_name.upper()} • 6 CONTROL ZONES DOSSIER"
    t_cell.font = Font(name="Segoe UI", size=13, bold=True, color="FFFFFF")
    t_cell.fill = PatternFill(start_color=NAVY_HEADER, end_color=NAVY_HEADER, fill_type="solid")
    t_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws_main.row_dimensions[1].height = 36

    ws_main.merge_cells("A2:J2")
    sub_cell = ws_main["A2"]
    sub_cell.value = f"Facility Manager: {manager_name} ({manager_email}) • Snapshot: {today.strftime('%d %B %Y')} • Strictly Confidential"
    sub_cell.font = Font(name="Segoe UI", size=9, italic=True, color="64748B")
    sub_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws_main.row_dimensions[2].height = 20

    # KPI Row
    kpi_headers = ["Total Active POs", "Zone 1 (Overdue)", "Zone 2 (Stage Delay)", "Zone 3 (Due 7d)", "Zone 4 (In QC)", "Zone 6 (Cleared)"]
    kpi_values = [
        len(active_orders),
        len(zones_map[1]),
        len(zones_map[2]),
        len(zones_map[3]),
        len(zones_map[4]),
        len(zones_map[6]),
    ]
    for idx, (kh, kv) in enumerate(zip(kpi_headers, kpi_values), 1):
        cell_h = ws_main.cell(row=4, column=idx+1, value=kh)
        cell_h.font = Font(name="Segoe UI", size=8, bold=True, color="475569")
        cell_h.alignment = Alignment(horizontal="center", vertical="center")
        cell_h.fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
        
        cell_v = ws_main.cell(row=5, column=idx+1, value=kv)
        cell_v.font = Font(name="Segoe UI", size=14, bold=True, color=NAVY_HEADER)
        cell_v.alignment = Alignment(horizontal="center", vertical="center")
        cell_v.fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
        cell_v.border = THIN_BORDER

    ws_main.row_dimensions[4].height = 18
    ws_main.row_dimensions[5].height = 26

    # Master Table Headers
    headers = [
        "PO Reference", "Style Description", "Quantity", "Control Zone",
        "Current Stage", "Committed Ex-Factory", "Schedule Metric",
        "Delay Reason / CAPA", "One-Click Email", "Portal Link"
    ]
    ws_main.row_dimensions[7].height = 26
    for c_i, h in enumerate(headers, 1):
        c = ws_main.cell(row=7, column=c_i, value=h)
        c.font = Font(name="Segoe UI", size=9, bold=True, color="FFFFFF")
        c.fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        c.alignment = Alignment(horizontal="center", vertical="center")

    r_idx = 8
    for o in active_orders:
        z_num = classify_order_zone(o, today)
        z_meta = ZONE_STYLES[z_num]
        pno = o.order_no or f"PO #{str(o.id)[:8]}"
        pstyle = o.style_name or o.product_name or "Apparel Batch"
        pqty = o.quantity or 0
        pex = str(o.ex_factory_date) if o.ex_factory_date else "TBD"

        if z_num == 1:
            days_late = (today - o.ex_factory_date).days if o.ex_factory_date else o.delay_days
            metric_str = f"🚨 {days_late}d Overdue"
        elif z_num == 3:
            days_left = (o.ex_factory_date - today).days if o.ex_factory_date else 0
            metric_str = f"⚡ Due in {days_left}d"
        elif z_num == 6:
            metric_str = "✅ Shipped"
        elif z_num == 4:
            metric_str = "🔍 In Inspection"
        else:
            metric_str = "⏱️ In Progress"

        stg = "Planning"
        if o.stages:
            act = next((s for s in o.stages if s.status != StageStatus.completed), o.stages[-1])
            sn = act.stage_name.value if hasattr(act.stage_name, "value") else str(act.stage_name)
            stg = sn.replace("_", " ").title()

        capa = o.delay_capa or o.delay_reason or "—"
        mailto_url = _format_mailto_link(manager_email, manager_name, pno, z_meta["name"], metric_str, cc_emails)
        order_url = f"{base_url}/orders/{o.id}"

        ws_main.cell(row=r_idx, column=1, value=pno).font = Font(name="Segoe UI", bold=True, color="0F172A")
        ws_main.cell(row=r_idx, column=2, value=pstyle)
        ws_main.cell(row=r_idx, column=3, value=pqty).number_format = "#,##0"
        
        c_zone = ws_main.cell(row=r_idx, column=4, value=f"Zone {z_num}: {z_meta['badge']}")
        c_zone.font = Font(name="Segoe UI", bold=True, color=z_meta["color"])
        c_zone.fill = PatternFill(start_color=z_meta["bg"], end_color=z_meta["bg"], fill_type="solid")
        c_zone.alignment = Alignment(horizontal="center", vertical="center")

        ws_main.cell(row=r_idx, column=5, value=stg)
        ws_main.cell(row=r_idx, column=6, value=pex).alignment = Alignment(horizontal="center", vertical="center")
        ws_main.cell(row=r_idx, column=7, value=metric_str).alignment = Alignment(horizontal="center", vertical="center")
        ws_main.cell(row=r_idx, column=8, value=capa)

        c_mail = ws_main.cell(row=r_idx, column=9)
        c_mail.value = f'=HYPERLINK("{mailto_url}", "✉️ Email Manager")'
        c_mail.font = Font(name="Segoe UI", bold=True, color="0284C7", underline="single")
        c_mail.alignment = Alignment(horizontal="center", vertical="center")

        c_link = ws_main.cell(row=r_idx, column=10)
        c_link.value = f'=HYPERLINK("{order_url}", "🔗 View Details")'
        c_link.font = Font(name="Segoe UI", bold=True, color="2563EB", underline="single")
        c_link.alignment = Alignment(horizontal="center", vertical="center")

        for col_c in range(1, 11):
            ws_main.cell(row=r_idx, column=col_c).border = THIN_BORDER
        ws_main.row_dimensions[r_idx].height = 20
        r_idx += 1

    # ── TABS 2 TO 7: ONE SEPARATE SHEET PER ZONE ──
    tab_names = {
        1: "Zone 1 - Overdue (CAPA)",
        2: "Zone 2 - Stage Delays",
        3: "Zone 3 - Due in 7 Days",
        4: "Zone 4 - In Final QC",
        5: "Zone 5 - Rework Protocol",
        6: "Zone 6 - QC Cleared",
    }

    for z_i in range(1, 7):
        z_meta = ZONE_STYLES[z_i]
        ws_z = wb.create_sheet(title=tab_names[z_i])
        ws_z.views.sheetView[0].showGridLines = True

        # Header
        ws_z.merge_cells("A1:H1")
        zh_cell = ws_z["A1"]
        zh_cell.value = f"{factory_name.upper()} • {z_meta['name']}"
        zh_cell.font = Font(name="Segoe UI", size=12, bold=True, color=z_meta["color"])
        zh_cell.fill = PatternFill(start_color=z_meta["bg"], end_color=z_meta["bg"], fill_type="solid")
        zh_cell.alignment = Alignment(horizontal="center", vertical="center")
        ws_z.row_dimensions[1].height = 32

        # Column headers
        z_headers = [
            "PO Reference", "Style Description", "Quantity", "Committed Date",
            "Current Stage", "Delay / Urgency Metric", "Action Link", "Portal Link"
        ]
        ws_z.row_dimensions[3].height = 24
        for c_idx, zh in enumerate(z_headers, 1):
            cell = ws_z.cell(row=3, column=c_idx, value=zh)
            cell.font = Font(name="Segoe UI", size=9, bold=True, color="334155")
            cell.fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = THIN_BORDER

        z_orders = zones_map[z_i]
        if not z_orders:
            ws_z.merge_cells("A4:H4")
            empty_c = ws_z["A4"]
            empty_c.value = f"✅ No active orders currently classified in {z_meta['name']}."
            empty_c.font = Font(name="Segoe UI", size=10, italic=True, color="64748B")
            empty_c.alignment = Alignment(horizontal="center", vertical="center")
            ws_z.row_dimensions[4].height = 24
            continue

        z_r = 4
        for ord_item in z_orders:
            pno = ord_item.order_no or f"PO #{str(ord_item.id)[:8]}"
            pstyle = ord_item.style_name or ord_item.product_name or "Apparel Style"
            pqty = ord_item.quantity or 0
            pex = str(ord_item.ex_factory_date) if ord_item.ex_factory_date else "TBD"

            if z_i == 1:
                days_late = (today - ord_item.ex_factory_date).days if ord_item.ex_factory_date else ord_item.delay_days
                metric = f"🚨 {days_late} Days Overdue (CAPA Required)"
            elif z_i == 3:
                days_left = (ord_item.ex_factory_date - today).days if ord_item.ex_factory_date else 0
                metric = f"⚡ Due in {days_left} Days (Final QC Verification)"
            elif z_i == 6:
                metric = "✅ Cleared For Shipment"
            elif z_i == 4:
                metric = "🔍 Ready For Final QC Sign-Off"
            elif z_i == 5:
                metric = "⚠️ Rework Action In Progress"
            else:
                metric = "⏱️ Production Line In-Progress"

            stg = "Planning"
            if ord_item.stages:
                act = next((s for s in ord_item.stages if s.status != StageStatus.completed), ord_item.stages[-1])
                sn = act.stage_name.value if hasattr(act.stage_name, "value") else str(act.stage_name)
                stg = sn.replace("_", " ").title()

            mailto_url = _format_mailto_link(manager_email, manager_name, pno, z_meta["name"], metric, cc_emails)
            order_url = f"{base_url}/orders/{ord_item.id}"

            ws_z.cell(row=z_r, column=1, value=pno).font = Font(name="Segoe UI", bold=True, color="0F172A")
            ws_z.cell(row=z_r, column=2, value=pstyle)
            ws_z.cell(row=z_r, column=3, value=pqty).number_format = "#,##0"
            ws_z.cell(row=z_r, column=4, value=pex).alignment = Alignment(horizontal="center", vertical="center")
            ws_z.cell(row=z_r, column=5, value=stg)
            ws_z.cell(row=z_r, column=6, value=metric).alignment = Alignment(horizontal="center", vertical="center")

            c_act = ws_z.cell(row=z_r, column=7)
            c_act.value = f'=HYPERLINK("{mailto_url}", "✉️ Email Manager")'
            c_act.font = Font(name="Segoe UI", bold=True, color="0284C7", underline="single")
            c_act.alignment = Alignment(horizontal="center", vertical="center")

            c_link = ws_z.cell(row=z_r, column=8)
            c_link.value = f'=HYPERLINK("{order_url}", "🔗 View Details")'
            c_link.font = Font(name="Segoe UI", bold=True, color="2563EB", underline="single")
            c_link.alignment = Alignment(horizontal="center", vertical="center")

            for col_c in range(1, 9):
                ws_z.cell(row=z_r, column=col_c).border = THIN_BORDER
            ws_z.row_dimensions[z_r].height = 20
            z_r += 1

    # Auto-adjust column widths across all sheets
    for ws in wb.worksheets:
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val = str(cell.value or "")
                if val.startswith("="):
                    if '", "' in val:
                        val = val.split('", "')[-1].rstrip('")')
                if len(val) > max_len and not cell.coordinate in ws.merged_cells:
                    max_len = len(val)
            ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


# ─── 2. MULTI-FACTORY WORKBOOK (ALL FACTORIES FOR SUPER ADMIN) ──────────────

def build_multi_factory_6_zones_workbook(db_orders: List[Order]) -> io.BytesIO:
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    today = date.today()
    base_url = getattr(settings, "APP_BASE_URL", "https://textileapperal.com").rstrip("/")
    if "localhost" in base_url:
        base_url = "https://textileapperal.com"

    factories: Dict[str, List[Order]] = {}
    for o in db_orders:
        if not o.is_active or o.status == OrderStatus.cancelled:
            continue
        vname = o.vendor.name if o.vendor and o.vendor.name else "Main Production Facility"
        factories.setdefault(vname, []).append(o)

    # Master Sheet
    ws_master = wb.create_sheet(title="Master Summary (All)")
    ws_master.views.sheetView[0].showGridLines = True

    ws_master.merge_cells("A1:K1")
    title_cell = ws_master["A1"]
    title_cell.value = "COTTON COLLECTIVE • 6 CONTROL ZONES MULTI-FACTORY MASTER REPORT"
    title_cell.font = Font(name="Segoe UI", size=14, bold=True, color="FFFFFF")
    title_cell.fill = PatternFill(start_color=NAVY_HEADER, end_color=NAVY_HEADER, fill_type="solid")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws_master.row_dimensions[1].height = 40

    ws_master.merge_cells("A2:K2")
    sub_cell = ws_master["A2"]
    sub_cell.value = f"Live Rollup as of {today.strftime('%d %B %Y')} | Click '✉️ Email Manager' to directly message responsible facility leads"
    sub_cell.font = Font(name="Segoe UI", size=10, italic=True, color="64748B")
    sub_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws_master.row_dimensions[2].height = 22

    headers_master = [
        "Factory / Facility", "PO Reference", "Style Description", "Buyer",
        "Quantity", "Control Zone", "Current Stage", "Ex-Factory Date",
        "Schedule Status", "Direct Action (Email Manager)", "Portal Link",
    ]
    ws_master.row_dimensions[4].height = 28
    for col_idx, h in enumerate(headers_master, 1):
        cell = ws_master.cell(row=4, column=col_idx, value=h)
        cell.font = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center")

    row_idx = 5
    for fname, o_list in factories.items():
        v = o_list[0].vendor if o_list else None
        mgr_name = v.assigned_manager.full_name if (v and v.assigned_manager) else "Factory Operations"
        mgr_email = v.assigned_manager.email if (v and v.assigned_manager) else "qc@cottoncollective.org"

        for o in o_list:
            zone_num = classify_order_zone(o, today)
            z_info = ZONE_STYLES[zone_num]

            pno = o.order_no or f"PO #{str(o.id)[:8]}"
            pstyle = o.style_name or o.product_name or "Apparel Batch"
            pqty = o.quantity or 0
            pex = str(o.ex_factory_date) if o.ex_factory_date else "TBD"

            if zone_num == 1:
                days_late = (today - o.ex_factory_date).days if o.ex_factory_date else o.delay_days
                delay_str = f"🚨 {days_late}d Overdue"
            elif zone_num == 3:
                days_left = (o.ex_factory_date - today).days if o.ex_factory_date else 0
                delay_str = f"⚡ Due in {days_left}d"
            elif zone_num == 6:
                delay_str = "✅ Shipped"
            elif zone_num == 4:
                delay_str = "🔍 In Inspection"
            else:
                delay_str = "⏱️ In Progress"

            stage_str = "Planning"
            if o.stages:
                active_s = next((s for s in o.stages if s.status != StageStatus.completed), o.stages[-1])
                sname = active_s.stage_name.value if hasattr(active_s.stage_name, "value") else str(active_s.stage_name)
                stage_str = sname.replace("_", " ").title()

            order_url = f"{base_url}/orders/{o.id}"
            mailto_url = _format_mailto_link(mgr_email, mgr_name, pno, z_info["name"], delay_str)

            ws_master.cell(row=row_idx, column=1, value=fname).alignment = Alignment(vertical="center")
            ws_master.cell(row=row_idx, column=2, value=pno).font = Font(name="Segoe UI", bold=True, color="0F172A")
            ws_master.cell(row=row_idx, column=3, value=pstyle)
            ws_master.cell(row=row_idx, column=4, value="Cotton Collective")
            c_qty = ws_master.cell(row=row_idx, column=5, value=pqty)
            c_qty.number_format = "#,##0"
            c_qty.alignment = Alignment(horizontal="right", vertical="center")

            c_zone = ws_master.cell(row=row_idx, column=6, value=f"Zone {zone_num}: {z_info['badge']}")
            c_zone.font = Font(name="Segoe UI", bold=True, color=z_info["color"])
            c_zone.fill = PatternFill(start_color=z_info["bg"], end_color=z_info["bg"], fill_type="solid")
            c_zone.alignment = Alignment(horizontal="center", vertical="center")

            ws_master.cell(row=row_idx, column=7, value=stage_str)
            ws_master.cell(row=row_idx, column=8, value=pex).alignment = Alignment(horizontal="center", vertical="center")
            ws_master.cell(row=row_idx, column=9, value=delay_str).alignment = Alignment(horizontal="center", vertical="center")

            c_mail = ws_master.cell(row=row_idx, column=10)
            c_mail.value = f'=HYPERLINK("{mailto_url}", "✉️ Email {mgr_name}")'
            c_mail.font = Font(name="Segoe UI", bold=True, color="0284C7", underline="single")
            c_mail.alignment = Alignment(horizontal="center", vertical="center")

            c_link = ws_master.cell(row=row_idx, column=11)
            c_link.value = f'=HYPERLINK("{order_url}", "🔗 View PO")'
            c_link.font = Font(name="Segoe UI", bold=True, color="2563EB", underline="single")
            c_link.alignment = Alignment(horizontal="center", vertical="center")

            for c in range(1, 12):
                ws_master.cell(row=row_idx, column=c).border = THIN_BORDER
            ws_master.row_dimensions[row_idx].height = 22
            row_idx += 1

    # Add individual tabs for each factory
    for fname, o_list in factories.items():
        safe_title = fname[:28].replace("/", "-").replace(":", "-")
        ws_fac = wb.create_sheet(title=safe_title)
        ws_fac.views.sheetView[0].showGridLines = True

        v = o_list[0].vendor if o_list else None
        mgr_name = v.assigned_manager.full_name if (v and v.assigned_manager) else "Factory Operations"
        mgr_email = v.assigned_manager.email if (v and v.assigned_manager) else "qc@cottoncollective.org"

        ws_fac.merge_cells("A1:H1")
        f_title = ws_fac["A1"]
        f_title.value = f"FACTORY DOSSIER: {fname.upper()} (MANAGER: {mgr_name.upper()} • {mgr_email})"
        f_title.font = Font(name="Segoe UI", size=13, bold=True, color="FFFFFF")
        f_title.fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        f_title.alignment = Alignment(horizontal="center", vertical="center")
        ws_fac.row_dimensions[1].height = 36

        fac_zones: Dict[int, List[Order]] = {z: [] for z in range(1, 7)}
        for o in o_list:
            z_num = classify_order_zone(o, today)
            fac_zones[z_num].append(o)

        f_row = 3
        for z_idx in (1, 2, 3, 4, 5, 6):
            z_meta = ZONE_STYLES[z_idx]
            z_orders = fac_zones[z_idx]

            ws_fac.merge_cells(f"A{f_row}:H{f_row}")
            z_banner = ws_fac[f"A{f_row}"]
            z_banner.value = f"  {z_meta['name']}  •  [{len(z_orders)} ORDERS RECORDED]"
            z_banner.font = Font(name="Segoe UI", size=11, bold=True, color=z_meta["color"])
            z_banner.fill = PatternFill(start_color=z_meta["bg"], end_color=z_meta["bg"], fill_type="solid")
            z_banner.alignment = Alignment(horizontal="left", vertical="center")
            ws_fac.row_dimensions[f_row].height = 26
            f_row += 1

            f_headers = ["PO Reference", "Style Name", "Quantity", "Committed Ex-Factory", "Current Stage", "Status Metric", "Action Link", "Portal Link"]
            for c_i, fh in enumerate(f_headers, 1):
                c = ws_fac.cell(row=f_row, column=c_i, value=fh)
                c.font = Font(name="Segoe UI", size=9, bold=True, color="334155")
                c.fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
                c.alignment = Alignment(horizontal="center", vertical="center")
                c.border = THIN_BORDER
            ws_fac.row_dimensions[f_row].height = 22
            f_row += 1

            if not z_orders:
                ws_fac.merge_cells(f"A{f_row}:H{f_row}")
                no_ord = ws_fac[f"A{f_row}"]
                no_ord.value = f"✅ No active orders currently flagged in {z_meta['name']}."
                no_ord.font = Font(name="Segoe UI", size=9, italic=True, color="64748B")
                no_ord.alignment = Alignment(horizontal="center", vertical="center")
                ws_fac.row_dimensions[f_row].height = 20
                f_row += 2
                continue

            for ord_item in z_orders:
                pno = ord_item.order_no or f"PO #{str(ord_item.id)[:8]}"
                pstyle = ord_item.style_name or ord_item.product_name or "Apparel Batch"
                pqty = ord_item.quantity or 0
                pex = str(ord_item.ex_factory_date) if ord_item.ex_factory_date else "TBD"

                if z_idx == 1:
                    days_late = (today - ord_item.ex_factory_date).days if ord_item.ex_factory_date else ord_item.delay_days
                    metric_str = f"🚨 {days_late}d Overdue"
                elif z_idx == 3:
                    days_left = (ord_item.ex_factory_date - today).days if ord_item.ex_factory_date else 0
                    metric_str = f"⚡ Due in {days_left}d"
                elif z_idx == 6:
                    metric_str = "✅ Shipped"
                elif z_idx == 4:
                    metric_str = "🔍 In Inspection"
                else:
                    metric_str = "⏱️ In Progress"

                stg = "Planning"
                if ord_item.stages:
                    act = next((s for s in ord_item.stages if s.status != StageStatus.completed), ord_item.stages[-1])
                    sn = act.stage_name.value if hasattr(act.stage_name, "value") else str(act.stage_name)
                    stg = sn.replace("_", " ").title()

                mailto_url = _format_mailto_link(mgr_email, mgr_name, pno, z_meta["name"], metric_str)
                order_url = f"{base_url}/orders/{ord_item.id}"

                ws_fac.cell(row=f_row, column=1, value=pno).font = Font(name="Segoe UI", bold=True, color="0F172A")
                ws_fac.cell(row=f_row, column=2, value=pstyle)
                c_q = ws_fac.cell(row=f_row, column=3, value=pqty)
                c_q.number_format = "#,##0"
                c_q.alignment = Alignment(horizontal="right", vertical="center")
                ws_fac.cell(row=f_row, column=4, value=pex).alignment = Alignment(horizontal="center", vertical="center")
                ws_fac.cell(row=f_row, column=5, value=stg)
                ws_fac.cell(row=f_row, column=6, value=metric_str).alignment = Alignment(horizontal="center", vertical="center")

                c_act = ws_fac.cell(row=f_row, column=7)
                c_act.value = f'=HYPERLINK("{mailto_url}", "✉️ Email {mgr_name}")'
                c_act.font = Font(name="Segoe UI", bold=True, color="0284C7", underline="single")
                c_act.alignment = Alignment(horizontal="center", vertical="center")

                c_l = ws_fac.cell(row=f_row, column=8)
                c_l.value = f'=HYPERLINK("{order_url}", "🔗 View Details")'
                c_l.font = Font(name="Segoe UI", bold=True, color="2563EB", underline="single")
                c_l.alignment = Alignment(horizontal="center", vertical="center")

                for cc in range(1, 9):
                    ws_fac.cell(row=f_row, column=cc).border = THIN_BORDER
                ws_fac.row_dimensions[f_row].height = 20
                f_row += 1

            f_row += 1

    for ws in wb.worksheets:
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val = str(cell.value or "")
                if val.startswith("="):
                    if '", "' in val:
                        val = val.split('", "')[-1].rstrip('")')
                if len(val) > max_len and not cell.coordinate in ws.merged_cells:
                    max_len = len(val)
            ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output
