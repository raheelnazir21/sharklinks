import io
from datetime import datetime, date
from typing import List, Any
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.hyperlink import Hyperlink


def _get_order_stage_details(order: Any) -> dict:
    active_stages = sorted(order.stages, key=lambda s: s.stage_order)
    total_stages = len(active_stages)
    completed_stages = sum(
        1 for s in active_stages 
        if (s.status.value if hasattr(s.status, "value") else str(s.status)) == "completed"
    )
    progress_pct = round((completed_stages / total_stages) * 100) if total_stages > 0 else (
        100 if (order.status.value if hasattr(order.status, "value") else str(order.status)) == "completed" else 0
    )
    
    # Identify active / current stage:
    # 1. in_progress stage
    current_st = next(
        (s for s in active_stages if (s.status.value if hasattr(s.status, "value") else str(s.status)) == "in_progress"),
        None
    )
    # 2. delayed stage
    if not current_st:
        current_st = next(
            (s for s in active_stages if (s.status.value if hasattr(s.status, "value") else str(s.status)) == "delayed"),
            None
        )
    # 3. If all completed, final stage
    if not current_st and completed_stages == total_stages and total_stages > 0:
        current_st = active_stages[-1]
    # 4. First pending or most recently updated
    if not current_st and active_stages:
        stages_with_update = [s for s in active_stages if s.updated_at]
        if stages_with_update:
            current_st = max(stages_with_update, key=lambda s: s.updated_at)
        else:
            current_st = active_stages[0]
            
    stage_name = ""
    stage_status = "pending"
    stage_target = ""
    stage_remarks = ""
    latest_update_dt = None
    if current_st:
        stage_name = current_st.stage_name.value if hasattr(current_st.stage_name, "value") else str(current_st.stage_name)
        stage_status = current_st.status.value if hasattr(current_st.status, "value") else str(current_st.status)
        stage_target = current_st.target_date.strftime("%Y-%m-%d") if current_st.target_date else ""
        stage_remarks = current_st.remarks or ""
        latest_update_dt = current_st.updated_at
        
    if not latest_update_dt:
        latest_update_dt = order.updated_at or order.created_at

    # Delivery & delay calculation
    deliv_status = "On Schedule"
    ex_fac_str = ""
    if order.ex_factory_date:
        ex_fac_str = order.ex_factory_date.strftime("%Y-%m-%d")
        if order.status and (order.status.value if hasattr(order.status, "value") else str(order.status)) == "completed":
            deliv_status = "Shipped / Done"
        else:
            delta = (order.ex_factory_date - date.today()).days
            if delta < 0:
                deliv_status = f"{abs(delta)}d DELAYED"
            elif delta == 0:
                deliv_status = "DUE TODAY"
            else:
                deliv_status = f"{delta}d left"
    elif order.status and (order.status.value if hasattr(order.status, "value") else str(order.status)) == "completed":
        deliv_status = "Completed"

    clean_stage_title = stage_name.replace("_", " ").title() if stage_name else "No Stages"

    return {
        "total_stages": total_stages,
        "completed_stages": completed_stages,
        "progress_pct": progress_pct,
        "stage_title": clean_stage_title,
        "stage_status": stage_status,
        "stage_target": stage_target,
        "stage_remarks": stage_remarks,
        "latest_update_dt": latest_update_dt,
        "ex_fac_str": ex_fac_str,
        "deliv_status": deliv_status,
    }


def generate_classes_workbook(
    classes: List[Any],
    track_title: str = "Sample Classes",
    accent_color: str = "0F766E",
) -> io.BytesIO:
    """
    Generates an executive-ready, multi-sheet Excel (.xlsx) workbook.
    - Sheet 1: Master WIP Overview (All products & classes with KPIs, filters, color badges)
    - Sheets 2..N: Dedicated Tab per Class / Project with detailed stages & notes
    """
    wb = openpyxl.Workbook()

    # Typography & Styles
    font_name = "Segoe UI"
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid") # Slate-800
    header_font = Font(name=font_name, size=10, bold=True, color="FFFFFF")
    title_font = Font(name=font_name, size=15, bold=True, color="0F172A")
    meta_font = Font(name=font_name, size=9.5, italic=True, color="64748B")
    regular_font = Font(name=font_name, size=9.5, color="1E293B")
    bold_font = Font(name=font_name, size=9.5, bold=True, color="0F172A")
    meta_header_font = Font(name=font_name, size=9.5, bold=True, color="475569")
    link_font = Font(name=font_name, size=9.5, color="2563EB", underline="single")

    thin_border = Border(
        left=Side(style="thin", color="E2E8F0"),
        right=Side(style="thin", color="E2E8F0"),
        top=Side(style="thin", color="E2E8F0"),
        bottom=Side(style="thin", color="E2E8F0")
    )

    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

    # Status fills & fonts
    status_styles = {
        "completed": {
            "fill": PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid"),
            "font": Font(name=font_name, size=9.5, color="15803D", bold=True),
        },
        "in_progress": {
            "fill": PatternFill(start_color="E0F2FE", end_color="E0F2FE", fill_type="solid"),
            "font": Font(name=font_name, size=9.5, color="0369A1", bold=True),
        },
        "delayed": {
            "fill": PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid"),
            "font": Font(name=font_name, size=9.5, color="B91C1C", bold=True),
        },
        "pending": {
            "fill": PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid"),
            "font": Font(name=font_name, size=9.5, color="B45309", bold=True),
        }
    }

    # ─── TAB 1: MASTER OVERVIEW ──────────────────────────────────────────────
    ws_master = wb.active
    ws_master.title = "Master Overview"
    ws_master.views.sheetView[0].showGridLines = True

    # Title Block
    ws_master["A1"] = f"FACTORY PRODUCTION WORK-IN-PROGRESS (WIP) — {track_title.upper()}"
    ws_master["A1"].font = title_font
    ws_master["A2"] = f"Multi-Class Master Production Schedule | Generated on {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    ws_master["A2"].font = meta_font

    master_headers = [
        "Class Serial", "Class Name", "Customer", "Vendor", "Product Name", "Style Code",
        "Order / PO #", "Quantity", "Current Stage", "Stage Status", "Stage Target",
        "Progress", "Ex-Factory Date", "Delivery Status", "Class Tab"
    ]

    header_row_idx = 4
    ws_master.row_dimensions[header_row_idx].height = 24
    for col_idx, h in enumerate(master_headers, start=1):
        cell = ws_master.cell(row=header_row_idx, column=col_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center" if any(k in h for k in ["Date", "Progress", "Status", "Quantity", "Target", "Tab", "Serial"]) else "left", vertical="center")

    current_m_row = 5
    total_products_count = 0
    total_delayed_count = 0

    sheet_names_map = {}
    used_titles = set()

    for sc in classes:
        raw_serial = sc.serial_number or "SC"
        raw_name = sc.name or "Untitled"
        clean_name = str(raw_name).replace("/", "-").replace("\\", "-").replace(":", "-").replace("?", "").replace("*", "").replace("[", "").replace("]", "").replace("'", "")
        tab_title = f"{raw_serial} - {clean_name}"[:28]
        # Ensure uniqueness
        counter = 1
        base_title = tab_title
        while tab_title in used_titles:
            tab_title = f"{base_title[:25]}_{counter}"
            counter += 1
        used_titles.add(tab_title)
        sheet_names_map[str(sc.id)] = tab_title

        active_orders = [o for o in sc.orders if o.is_active] if hasattr(sc, "orders") else []
        vendor_name = sc.vendor.name if getattr(sc, "vendor", None) else "—"

        for order in active_orders:
            total_products_count += 1
            details = _get_order_stage_details(order)
            if "DELAYED" in details["deliv_status"]:
                total_delayed_count += 1

            row_data = [
                sc.serial_number or "—",
                sc.name or "—",
                sc.customer or "—",
                vendor_name,
                order.product_name or "—",
                order.style_name or "—",
                order.order_no or "—",
                order.quantity or 0,
                details["stage_title"],
                details["stage_status"],
                details["stage_target"],
                f"{details['completed_stages']}/{details['total_stages']} ({details['progress_pct']}%)",
                details["ex_fac_str"] or "—",
                details["deliv_status"],
                f"Go to '{tab_title}'"
            ]

            fill_to_use = zebra_fill if (current_m_row % 2 == 0) else white_fill
            ws_master.row_dimensions[current_m_row].height = 20

            for col_idx, val in enumerate(row_data, start=1):
                cell = ws_master.cell(row=current_m_row, column=col_idx, value=val)
                cell.font = regular_font
                cell.border = thin_border
                cell.fill = fill_to_use

                # Specific column formatting
                if col_idx == 8:  # Quantity
                    cell.number_format = "#,##0"
                    cell.alignment = Alignment(horizontal="right", vertical="center")
                elif col_idx in (1, 11, 12, 13):
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                elif col_idx == 10:  # Stage Status
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                    st_key = str(val).lower()
                    if st_key in status_styles:
                        cell.fill = status_styles[st_key]["fill"]
                        cell.font = status_styles[st_key]["font"]
                elif col_idx == 14:  # Delivery Status
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                    if "DELAYED" in str(val):
                        cell.fill = status_styles["delayed"]["fill"]
                        cell.font = status_styles["delayed"]["font"]
                    elif "Shipped" in str(val) or "Completed" in str(val):
                        cell.fill = status_styles["completed"]["fill"]
                        cell.font = status_styles["completed"]["font"]
                elif col_idx == 15:  # Clickable tab link
                    safe_tab = tab_title.replace("'", "''")
                    cell.hyperlink = Hyperlink(ref=cell.coordinate, location=f"'{safe_tab}'!A1", display=str(val))
                    cell.font = link_font
                    cell.alignment = Alignment(horizontal="center", vertical="center")

            current_m_row += 1

    # Auto-fit columns on Master Sheet
    for col in ws_master.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws_master.column_dimensions[col_letter].width = max(max_len + 3, 11)

    ws_master.freeze_panes = "A5"

    # ─── TABS 2..N: DEDICATED CLASS SHEETS ───────────────────────────────────
    banner_fill = PatternFill(start_color=accent_color, end_color=accent_color, fill_type="solid")
    banner_font = Font(name=font_name, size=13, bold=True, color="FFFFFF")

    for sc in classes:
        tab_title = sheet_names_map.get(str(sc.id), "Class Sheet")
        ws = wb.create_sheet(title=tab_title)
        ws.views.sheetView[0].showGridLines = True

        active_orders = [o for o in sc.orders if o.is_active] if hasattr(sc, "orders") else []
        vendor_name = sc.vendor.name if getattr(sc, "vendor", None) else "—"

        # Class Header Banner
        ws.merge_cells("A1:K1")
        b_cell = ws["A1"]
        b_cell.value = f"PROJECT DETAILS: [{sc.serial_number or 'NO-SN'}] {str(sc.name).upper()}"
        b_cell.fill = banner_fill
        b_cell.font = banner_font
        b_cell.alignment = Alignment(horizontal="left", vertical="center", indent=1)
        ws.row_dimensions[1].height = 28

        # Class Metadata Card (Rows 3-4)
        ws["A3"] = "Customer:"; ws["A3"].font = meta_header_font
        ws["B3"] = sc.customer or "—"; ws["B3"].font = bold_font
        ws["D3"] = "Assigned Vendor:"; ws["D3"].font = meta_header_font
        ws["E3"] = vendor_name; ws["E3"].font = bold_font
        ws["G3"] = "Class Status:"; ws["G3"].font = meta_header_font
        ws["H3"] = (sc.status or "active").upper(); ws["H3"].font = bold_font

        ws["A4"] = "Active Styles:"; ws["A4"].font = meta_header_font
        ws["B4"] = len(active_orders); ws["B4"].font = bold_font
        ws["D4"] = "Total Quantity:"; ws["D4"].font = meta_header_font
        tot_qty = sum(o.quantity or 0 for o in active_orders)
        ws["E4"] = tot_qty; ws["E4"].font = bold_font; ws["E4"].number_format = "#,##0"
        ws["G4"] = "Navigation:"; ws["G4"].font = meta_header_font
        ws["H4"].value = "← Back to Master Overview"
        ws["H4"].hyperlink = Hyperlink(ref="H4", location="'Master Overview'!A1", display="← Back to Master Overview")
        ws["H4"].font = link_font

        # Product Table Headers (Row 6)
        class_table_headers = [
            "#", "Product Name", "Style Code", "Order / PO #", "Quantity",
            "Current Active Stage", "Stage Status", "Target Date", "Pipeline Progress",
            "Ex-Factory Date", "Delivery Status", "Latest Stage Notes"
        ]
        p_header_row = 6
        ws.row_dimensions[p_header_row].height = 24
        for col_idx, h in enumerate(class_table_headers, start=1):
            cell = ws.cell(row=p_header_row, column=col_idx, value=h)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center" if any(k in h for k in ["Date", "Progress", "Status", "Quantity", "Target", "#"]) else "left", vertical="center")

        # Populate Products
        p_row = 7
        for idx, order in enumerate(active_orders, start=1):
            details = _get_order_stage_details(order)
            fill_to_use = zebra_fill if (p_row % 2 == 0) else white_fill
            ws.row_dimensions[p_row].height = 20

            p_vals = [
                idx,
                order.product_name or "—",
                order.style_name or "—",
                order.order_no or "—",
                order.quantity or 0,
                details["stage_title"],
                details["stage_status"],
                details["stage_target"],
                f"{details['completed_stages']}/{details['total_stages']} ({details['progress_pct']}%)",
                details["ex_fac_str"] or "—",
                details["deliv_status"],
                details["stage_remarks"] or "—"
            ]

            for col_idx, val in enumerate(p_vals, start=1):
                cell = ws.cell(row=p_row, column=col_idx, value=val)
                cell.font = regular_font
                cell.border = thin_border
                cell.fill = fill_to_use

                if col_idx == 1:
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                elif col_idx == 5:
                    cell.number_format = "#,##0"
                    cell.alignment = Alignment(horizontal="right", vertical="center")
                elif col_idx in (8, 9, 10):
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                elif col_idx == 7:  # Stage Status
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                    st_key = str(val).lower()
                    if st_key in status_styles:
                        cell.fill = status_styles[st_key]["fill"]
                        cell.font = status_styles[st_key]["font"]
                elif col_idx == 11:  # Delivery Status
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                    if "DELAYED" in str(val):
                        cell.fill = status_styles["delayed"]["fill"]
                        cell.font = status_styles["delayed"]["font"]
                    elif "Shipped" in str(val) or "Completed" in str(val):
                        cell.fill = status_styles["completed"]["fill"]
                        cell.font = status_styles["completed"]["font"]

            p_row += 1

        # Auto-fit columns for this Class Sheet
        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 11)

        ws.freeze_panes = "A7"

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output
