import sys
import os
import json
import sqlalchemy as sa
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add parent directory to path so app can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import Base, engine as pg_engine
# Import all models to register them on Base.metadata
from app.models.user import User, Role, RefreshToken
from app.models.audit_log import AuditLog
from app.models.order import (
    Vendor, Order, ProductionStage, Attachment, OrderHistory, OrderAudit,
    OrderProductionAssignment, VendorDepartment, VendorFloor, VendorLine,
    SampleClass, BulkClass
)
from app.models.qc_report import (
    DefectCategory, DefectCode, QCReport, QCReportItem, QCReportItemDefect,
    QCReportAttachment, OperatorFlag, OperatorFlagHistory, ArticleCode, ProductColor
)
from app.models.inline_qc import (
    InlineQCReport, InlineQCOperation, InlineQCDefectRow,
    OperatorTrafficLightHistory, FinishEndlineQCReport, FinishEndlineQCHourlyRow
)

# Ordered list of models to avoid dependency violations if done sequentially
MODELS_TO_MIGRATE = [
    # 1. Base Auth & Roles
    Role,
    User,
    RefreshToken,
    AuditLog,
    
    # 2. Vendors & Infrastructure
    Vendor,
    VendorFloor,
    VendorLine,
    VendorDepartment,
    SampleClass,
    BulkClass,
    
    # 3. Orders & Stages
    Order,
    ProductionStage,
    Attachment,
    OrderHistory,
    OrderAudit,
    OrderProductionAssignment,
    
    # 4. Master QC Data
    DefectCategory,
    DefectCode,
    ArticleCode,
    ProductColor,
    
    # 5. General QC Reports
    QCReport,
    QCReportItem,
    QCReportItemDefect,
    QCReportAttachment,
    OperatorFlag,
    OperatorFlagHistory,
    
    # 6. Advanced QC Reports (Inline, Finished)
    InlineQCReport,
    InlineQCOperation,
    InlineQCDefectRow,
    OperatorTrafficLightHistory,
    FinishEndlineQCReport,
    FinishEndlineQCHourlyRow
]

def migrate(sqlite_db_path: str):
    if not os.path.exists(sqlite_db_path):
        print(f"❌ SQLite database file not found at: {sqlite_db_path}")
        sys.exit(1)

    print(f"🔌 Connecting to source SQLite: sqlite:///{sqlite_db_path}")
    lite_engine = create_engine(f"sqlite:///{sqlite_db_path}")
    LiteSession = sessionmaker(bind=lite_engine)
    lite_session = LiteSession()

    print(f"🔌 Connecting to target PostgreSQL: {pg_engine.url.render_as_string(hide_password=True)}")
    PgSession = sessionmaker(bind=pg_engine)
    pg_session = PgSession()

    # Disable constraints & triggers on Postgres session for safe bulk import
    print("🛡️ Disabling foreign key constraints on target PostgreSQL database...")
    pg_session.execute(text("SET session_replication_role = 'replica';"))
    pg_session.commit()

    inspector = sa.inspect(lite_engine)

    try:
        for model in MODELS_TO_MIGRATE:
            table_name = model.__tablename__
            
            # Check if table exists in SQLite
            if not inspector.has_table(table_name):
                print(f"⚠️ Table '{table_name}' does not exist in SQLite database. Skipping.")
                continue

            # Find columns that exist in both the SQLite table and the model
            sqlite_cols = {c['name'] for c in inspector.get_columns(table_name)}
            model_cols = {c.name for c in model.__table__.columns}
            common_cols = list(sqlite_cols.intersection(model_cols))

            if not common_cols:
                print(f"⚡ Table '{table_name}' has no common columns. Skipping.")
                continue

            # Query count in SQLite
            count_query = text(f"SELECT COUNT(*) FROM {table_name}")
            src_count = lite_session.execute(count_query).scalar()
            if src_count == 0:
                print(f"⚡ Table '{table_name}' has 0 records in SQLite. Skipping.")
                continue

            print(f"📥 Migrating '{table_name}' ({src_count} records, {len(common_cols)}/{len(model_cols)} columns)...")

            # Truncate existing data in target table
            pg_session.execute(text(f"TRUNCATE TABLE {table_name} CASCADE;"))
            pg_session.commit()

            # Retrieve all rows from SQLite with only common columns
            col_list_str = ", ".join([f'"{c}"' for c in common_cols])
            query = text(f"SELECT {col_list_str} FROM {table_name}")
            records = lite_session.execute(query).fetchall()

            # Identify JSON columns in the model
            json_cols = {
                c.name for c in model.__table__.columns 
                if isinstance(c.type, sa.JSON) or "json" in str(c.type).lower()
            }

            # Convert to list of dicts and parse JSON columns
            insert_data = []
            for row in records:
                row_dict = dict(zip(common_cols, row))
                # Parse JSON fields stored as strings in SQLite
                for j_col in json_cols:
                    if j_col in row_dict and isinstance(row_dict[j_col], str):
                        try:
                            val = row_dict[j_col].strip()
                            row_dict[j_col] = json.loads(val) if val else None
                        except Exception:
                            # Keep original if parsing fails
                            pass
                insert_data.append(row_dict)

            # Bulk insert into PostgreSQL in chunks
            if insert_data:
                chunk_size = 500
                for i in range(0, len(insert_data), chunk_size):
                    chunk = insert_data[i:i+chunk_size]
                    pg_session.execute(model.__table__.insert(), chunk)
                pg_session.commit()
            
            print(f"✅ Migrated '{table_name}' successfully.")

        # Update integer sequence IDs in Postgres so auto-increment works on new inserts
        print("🔄 Updating auto-increment sequences for primary keys...")
        for model in MODELS_TO_MIGRATE:
            table_name = model.__tablename__
            if not inspector.has_table(table_name):
                continue
            pk_cols = [c for c in model.__table__.primary_key.columns]
            if pk_cols and isinstance(pk_cols[0].type, sa.Integer):
                pk_name = pk_cols[0].name
                seq_query = text(f"""
                    SELECT setval(
                        pg_get_serial_sequence('{table_name}', '{pk_name}'),
                        COALESCE(MAX({pk_name}), 1)
                    ) FROM {table_name};
                """)
                try:
                    pg_session.execute(seq_query)
                    pg_session.commit()
                    print(f"  ⚡ Sequence reset for '{table_name}.{pk_name}'")
                except Exception as seq_err:
                    pg_session.rollback()
                    print(f"  ⚠️ Skipping sequence reset for '{table_name}': {seq_err}")

        print("🎉 SQLite to PostgreSQL migration finished successfully!")

    except Exception as e:
        pg_session.rollback()
        print(f"❌ Migration failed with error: {e}")
        raise e
    finally:
        # Re-enable constraints & triggers
        print("🛡️ Re-enabling foreign key constraints on target PostgreSQL database...")
        pg_session.execute(text("SET session_replication_role = 'origin';"))
        pg_session.commit()
        
        lite_session.close()
        pg_session.close()

if __name__ == "__main__":
    db_path = "textile_qc.db"
    if len(sys.argv) > 1:
        db_path = sys.argv[1]
    
    migrate(db_path)
