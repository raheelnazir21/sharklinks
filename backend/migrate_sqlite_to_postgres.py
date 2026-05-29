"""
SQLite to PostgreSQL Data Migration Script.
Copies all factory, user, order, and quality control data from SQLite to PostgreSQL.
Handles foreign key constraints by copying tables in dependency order.
"""
import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set python path to backend root
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import Base
from app.core.schema_maintenance import ensure_runtime_schema, sync_postgres_enums

# Import all models to ensure they are registered in Base
from app.models.user import Role, User, RefreshToken
from app.models.order import (
    Vendor, SampleClass, BulkClass, Order, ProductionStage, 
    Attachment, OrderHistory, OrderAudit, OrderProductionAssignment, 
    VendorDepartment, VendorFloor, VendorLine
)
from app.models.qc_report import (
    DefectCategory, DefectCode, QCReport, QCReportItem, 
    QCReportItemDefect, QCReportAttachment, OperatorFlag, OperatorFlagHistory,
    ArticleCode, ProductColor
)
from app.models.audit_log import AuditLog
from app.models.inline_qc import (
    CutPanelReport, CutPanelReportRow, BatchAuditReport, BatchAuditReportRow,
    InlineQCReport, InlineQCOperation, InlineQCDefectRow, 
    OperatorTrafficLightHistory, FinishEndlineQCReport, FinishEndlineQCHourlyRow
)

# Database URIs
SQLITE_URI = "sqlite:///textile_qc.db"
# If local file is inside backend/ subfolder
if not os.path.exists("textile_qc.db") and os.path.exists("backend/textile_qc.db"):
    SQLITE_URI = "sqlite:///backend/textile_qc.db"
elif not os.path.exists("textile_qc.db") and os.path.exists("../textile_qc.db"):
    SQLITE_URI = "sqlite:///../textile_qc.db"

POSTGRES_URI = "postgresql://postgres:password@localhost:5432/factory_db"

print(f"Reading from SQLite database: {SQLITE_URI}")
print(f"Writing to PostgreSQL database: {POSTGRES_URI}")

# Initialize engines and session makers
sqlite_engine = create_engine(SQLITE_URI)
postgres_engine = create_engine(POSTGRES_URI)

SqliteSession = sessionmaker(bind=sqlite_engine)
PostgresSession = sessionmaker(bind=postgres_engine)

# Dependency order for migrating tables
MIGRATION_ORDER = [
    (Role, "roles"),
    (User, "users"),
    (RefreshToken, "refresh_tokens"),
    (Vendor, "vendors"),
    (VendorDepartment, "vendor_departments"),
    (VendorFloor, "vendor_floors"),
    (VendorLine, "vendor_lines"),
    (SampleClass, "sample_classes"),
    (BulkClass, "bulk_classes"),
    (Order, "orders"),
    (ProductionStage, "production_stages"),
    (Attachment, "order_attachments"),
    (OrderHistory, "order_history"),
    (OrderAudit, "order_audits"),
    (OrderProductionAssignment, "order_production_assignments"),
    (DefectCategory, "qc_defect_categories"),
    (DefectCode, "qc_defect_codes"),
    (ArticleCode, "article_codes"),
    (ProductColor, "product_colors"),
    (QCReport, "qc_reports_v2"),
    (QCReportItem, "qc_report_items_v2"),
    (QCReportItemDefect, "qc_report_item_defects"),
    (QCReportAttachment, "qc_report_attachments"),
    (OperatorFlag, "operator_flags"),
    (OperatorFlagHistory, "operator_flag_history"),
    (AuditLog, "audit_logs"),
    (CutPanelReport, "cut_panel_reports"),
    (CutPanelReportRow, "cut_panel_report_rows"),
    (BatchAuditReport, "batch_audit_reports"),
    (BatchAuditReportRow, "batch_audit_report_rows"),
    (InlineQCReport, "inline_qc_reports"),
    (InlineQCOperation, "inline_qc_operations"),
    (InlineQCDefectRow, "inline_qc_defect_rows"),
    (OperatorTrafficLightHistory, "operator_traffic_light_history"),
    (FinishEndlineQCReport, "finish_endline_qc_reports"),
    (FinishEndlineQCHourlyRow, "finish_endline_qc_hourly_rows"),
]

def migrate_data():
    # 1. Create target Postgres schema
    print("Ensuring target PostgreSQL schemas and enums are created...")
    Base.metadata.create_all(bind=postgres_engine)
    ensure_runtime_schema(postgres_engine)
    sync_postgres_enums(postgres_engine)
    print("PostgreSQL schemas and enums initialized.")

    sqlite_db = SqliteSession()
    postgres_db = PostgresSession()

    try:
        for model, table_name in MIGRATION_ORDER:
            # Check if source table has records
            try:
                sqlite_records = sqlite_db.query(model).all()
            except Exception as e:
                print(f"Skipping table '{table_name}' (does not exist in SQLite or error occurred: {e})")
                continue

            if not sqlite_records:
                print(f"Table '{table_name}' has 0 records in SQLite. Skipping.")
                continue

            print(f"Migrating {len(sqlite_records)} records for '{table_name}'...")

            # Clean target table in Postgres to prevent duplicates
            postgres_db.query(model).delete()
            postgres_db.commit()

            # Copy to Postgres session
            for record in sqlite_records:
                # Merge detaches record from sqlite session and attaches it to target session
                # creating a new state row with identical attributes.
                postgres_db.merge(record)
            
            postgres_db.commit()
            print(f"Successfully migrated '{table_name}'.")

        print("\n🎉 Migration Completed Successfully!")
    except Exception as e:
        postgres_db.rollback()
        print(f"\n❌ Migration Failed: {e}")
    finally:
        sqlite_db.close()
        postgres_db.close()

if __name__ == "__main__":
    migrate_data()
