"""
Excel Export Service — generates data exports in .xlsx format.
Uses openpyxl for building multi-sheet workbooks.
"""
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from typing import List
from app.models.qc_report import QCReport

class ExcelService:

    @staticmethod
    def generate_qc_reports_excel(reports: List[QCReport]) -> BytesIO:
        wb = Workbook()
        ws = wb.active
        ws.title = "QC Reports Summary"
        
        # Headers
        headers = [
            "Order No", "Type", "Date", "Checked Qty", "Pass", "Reject", 
            "DHU %", "FPY %", "Status", "Auditor", "Line"
        ]
        
        # Style headers
        header_fill = PatternFill(start_color="333333", end_color="333333", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)
        
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")
            
        # Data
        for row, r in enumerate(reports, 2):
            ws.cell(row=row, column=1, value=r.order.order_no if r.order else "N/A")
            ws.cell(row=row, column=2, value=r.report_type)
            ws.cell(row=row, column=3, value=str(r.inspection_date))
            ws.cell(row=row, column=4, value=r.quantity_checked)
            ws.cell(row=row, column=5, value=r.quantity_passed)
            ws.cell(row=row, column=6, value=r.quantity_rejected)
            ws.cell(row=row, column=7, value=r.dhu_percent)
            ws.cell(row=row, column=8, value=r.fpy_percent)
            ws.cell(row=row, column=9, value=r.status)
            ws.cell(row=row, column=10, value=r.auditor_name or "N/A")
            ws.cell(row=row, column=11, value=r.line.name if r.line else "N/A")
            
        # Adjust column widths
        for col in ws.columns:
            max_length = 0
            column = col[0].column_letter
            for cell in col:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = (max_length + 2)
            ws.column_dimensions[column].width = adjusted_width
            
        buffer = BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer
