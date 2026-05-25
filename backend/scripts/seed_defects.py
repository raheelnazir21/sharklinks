"""
Seed script to populate default industrial defect codes based on user screenshots.
"""
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal
from app.models.qc_report import DefectCode, DefectCategory, QCReportType, DefectSeverity

def seed_defects():
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(DefectCode).first():
            print("Defects already seeded. Skipping...")
            return

        print("Seeding industrial defect codes...")

        # 1. END LINE / INLINE (Sewing)
        sewing_cat = DefectCategory(name="Sewing Defect", report_type=QCReportType.end_line)
        db.add(sewing_cat)
        db.flush()

        sewing_defects = [
            ("Skip Stitch", "ST-001"), ("Broken Stitch", "ST-002"), ("Open Seam", "SM-001"),
            ("Un-even Seam", "SM-002"), ("Raw Edge", "RE-001"), ("Miss Operation", "MO-001"),
            ("Pleats", "PL-001"), ("Puckering", "PK-001"), ("Shaded Panel", "SH-001"),
            ("Slant", "SL-001"), ("Joint Out", "JO-001"), ("Roping", "RP-001"),
            ("Needle Hole", "NH-001"), ("High & Low", "HL-001"), ("Center Out", "CO-001"),
            ("Insecure", "IS-001")
        ]
        
        for name, code in sewing_defects:
            db.add(DefectCode(name=name, code=code, report_type=QCReportType.end_line, category_id=sewing_cat.id, severity=DefectSeverity.major))
            db.add(DefectCode(name=name, code=code, report_type=QCReportType.inline, category_id=None, severity=DefectSeverity.major))

        # 2. CUT PANEL
        cutting_cat = DefectCategory(name="Cutting Defect", report_type=QCReportType.cut_panel)
        print_cat = DefectCategory(name="Printing & Embroidery", report_type=QCReportType.cut_panel)
        knit_cat = DefectCategory(name="Knitting & Dying", report_type=QCReportType.cut_panel)
        db.add_all([cutting_cat, print_cat, knit_cat])
        db.flush()

        # Cutting
        for name, code in [
            ("Missing Parts", "CP-001"), ("Shaded Components", "CP-002"), ("Uneven Shape", "CP-003"),
            ("Uneven Panel", "CP-004"), ("Wrong Size Shape", "CP-005"), ("Specs Out", "CP-006")
        ]:
            db.add(DefectCode(name=name, code=code, report_type=QCReportType.cut_panel, category_id=cutting_cat.id, severity=DefectSeverity.major))

        # Printing
        for name, code in [
            ("Slanted", "PE-001"), ("Damage", "PE-002"), ("Placement Out", "PE-003"),
            ("Incorrect", "PE-004"), ("Stain", "PE-005")
        ]:
            db.add(DefectCode(name=name, code=code, report_type=QCReportType.cut_panel, category_id=print_cat.id, severity=DefectSeverity.major))

        # Knitting
        for name, code in [
            ("Color Patch", "KD-001"), ("Knit Line", "KD-002"), ("Knit Hole", "KD-003"),
            ("Dead Cotton", "KD-004"), ("Yarn Variation", "KD-005"), ("Contamination", "KD-006")
        ]:
            db.add(DefectCode(name=name, code=code, report_type=QCReportType.cut_panel, category_id=knit_cat.id, severity=DefectSeverity.major))

        # 3. FINISHING
        finishing_cat = DefectCategory(name="Finishing Defect", report_type=QCReportType.finishing)
        db.add(finishing_cat)
        db.flush()

        for name, code in [
            ("Measurement Out", "FN-001"), ("Ironing Issue", "FN-002"), ("Stain", "FN-003"),
            ("Thread Trim", "FN-004"), ("Folding Issue", "FN-005"), ("Label Mistake", "FN-006")
        ]:
            db.add(DefectCode(name=name, code=code, report_type=QCReportType.finishing, category_id=finishing_cat.id, severity=DefectSeverity.major))

        db.commit()
        print("Successfully seeded industrial defects.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding defects: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_defects()
