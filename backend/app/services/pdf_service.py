"""
PDF Export Service — generates professional QC reports and summaries as PDF.
Uses reportlab for high-quality document generation.
"""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from app.models.qc_report import QCReport

class PDFService:

    @staticmethod
    def generate_qc_report_pdf(report: QCReport) -> BytesIO:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        elements = []
        styles = getSampleStyleSheet()
        
        # Header
        elements.append(Paragraph(f"QC Inspection Report - {report.report_type.value.capitalize()}", styles['Title']))
        elements.append(Spacer(1, 12))
        
        # Report Info
        info_data = [
            ["Order No:", report.order.order_no if report.order else "N/A", "Inspection Date:", str(report.inspection_date)],
            ["Line No:", report.line.name if report.line else "N/A", "Department:", "Production"],
            ["Total Pieces:", str(report.quantity_checked), "Pass Pieces:", str(report.quantity_passed)],
            ["Fail Pieces:", str(report.quantity_rejected), "DHU %:", f"{report.dhu_percent}%"],
            ["Status:", report.status.value.capitalize(), "FPY %:", f"{report.fpy_percent}%"]
        ]
        
        info_table = Table(info_data, colWidths=[100, 150, 100, 150])
        info_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('BACKGROUND', (2, 0), (2, -1), colors.lightgrey),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 24))
        
        # Defect Items
        elements.append(Paragraph("Defect Breakdown", styles['Heading2']))
        elements.append(Spacer(1, 12))
        
        defect_data = [["Code", "Description", "Quantity", "Operation", "Remarks"]]
        for item in report.items:
            defect_data.append([
                item.defect.code if item.defect else "N/A",
                item.defect.name if item.defect else "N/A",
                str(item.defect_count),
                item.operation or "",
                item.remarks or ""
            ])
            
        if len(defect_data) == 1:
            defect_data.append(["-", "No defects found", "-", "-", "-"])
            
        defect_table = Table(defect_data, colWidths=[80, 150, 60, 80, 130])
        defect_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(defect_table)
        
        doc.build(elements)
        buffer.seek(0)
        return buffer
