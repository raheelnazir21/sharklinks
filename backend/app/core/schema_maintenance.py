from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.models.order import (
    LocationStatus,
    OrderPriority,
    OrderStatus,
    StageName,
    StageStatus,
    TrackType,
)


POSTGRES_ENUMS = {
    "stagename": StageName,
    "locationstatus": LocationStatus,
    "tracktype": TrackType,
    "stagestatus": StageStatus,
    "orderstatus": OrderStatus,
    "orderpriority": OrderPriority,
}


def sync_postgres_enums(engine: Engine) -> None:
    """Keep existing local Postgres enum types aligned with Python enums."""
    if engine.dialect.name != "postgresql":
        return

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        for type_name, enum_cls in POSTGRES_ENUMS.items():
            labels = conn.execute(
                text(
                    """
                    SELECT enumlabel
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = :type_name
                    """
                ),
                {"type_name": type_name},
            ).scalars().all()

            if not labels:
                continue

            label_set = set(labels)
            for member in enum_cls:
                if member.name not in label_set:
                    conn.execute(
                        text(f"ALTER TYPE {type_name} ADD VALUE IF NOT EXISTS :label"),
                        {"label": member.name},
                    )


def ensure_runtime_schema(engine: Engine) -> None:
    """Apply tiny additive schema fixes for local/dev databases."""
    legacy_stage_names = {
        "Sample Start": "sample_start",
        "Fabrication": "fabrication",
        "Fabric Cutting": "fabric_cutting",
        "Embellishment": "embellishment",
        "Stitching": "stitching",
        "Washing": "washing",
        "QC Check": "qc_check",
        "Finishing": "finishing",
        "Packing & Dispatch": "dispatch",
        "Completed": "completed",
    }

    with engine.connect() as conn:
        if engine.dialect.name == "sqlite":
            assignment_info = conn.execute(text("PRAGMA table_info(order_production_assignments)")).fetchall()
            assignment_cols = {row[1] for row in assignment_info}
            if "department_id" not in assignment_cols:
                conn.execute(text("ALTER TABLE order_production_assignments ADD COLUMN department_id CHAR(36)"))
                assignment_info = conn.execute(text("PRAGMA table_info(order_production_assignments)")).fetchall()

            assignment_notnull = {row[1]: bool(row[3]) for row in assignment_info}
            if assignment_notnull.get("floor_id") or assignment_notnull.get("line_id"):
                conn.execute(text("ALTER TABLE order_production_assignments RENAME TO order_production_assignments_old"))
                conn.execute(text("""
                    CREATE TABLE order_production_assignments (
                        id CHAR(36) NOT NULL PRIMARY KEY,
                        order_id CHAR(36) NOT NULL,
                        vendor_id CHAR(36) NOT NULL,
                        floor_id CHAR(36),
                        line_id CHAR(36),
                        department_id CHAR(36),
                        assignment_type VARCHAR(50),
                        notes TEXT,
                        created_at DATETIME
                    )
                """))
                conn.execute(text("""
                    INSERT INTO order_production_assignments (
                        id, order_id, vendor_id, floor_id, line_id, department_id,
                        assignment_type, notes, created_at
                    )
                    SELECT
                        id, order_id, vendor_id, floor_id, line_id, department_id,
                        assignment_type, notes, created_at
                    FROM order_production_assignments_old
                """))
                conn.execute(text("DROP TABLE order_production_assignments_old"))

            order_cols = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(orders)")).fetchall()
            }
            if "reference_attachments" not in order_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN reference_attachments JSON"))
            attachment_cols = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(order_attachments)")).fetchall()
            }
            if "uploaded_by" not in attachment_cols:
                conn.execute(text("ALTER TABLE order_attachments ADD COLUMN uploaded_by CHAR(36)"))
            vendor_cols = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(vendors)")).fetchall()
            }
            if "assigned_manager_id" not in vendor_cols:
                conn.execute(text("ALTER TABLE vendors ADD COLUMN assigned_manager_id CHAR(36)"))
            sample_class_cols = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(sample_classes)")).fetchall()
            }
            if "created_by" not in sample_class_cols:
                conn.execute(text("ALTER TABLE sample_classes ADD COLUMN created_by CHAR(36)"))
            bulk_class_cols = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(bulk_classes)")).fetchall()
            }
            if "created_by" not in bulk_class_cols:
                conn.execute(text("ALTER TABLE bulk_classes ADD COLUMN created_by CHAR(36)"))
            for old_name, new_name in legacy_stage_names.items():
                conn.execute(
                    text("UPDATE production_stages SET stage_name = :new_name WHERE stage_name = :old_name"),
                    {"new_name": new_name, "old_name": old_name},
                )
            conn.commit()
        elif engine.dialect.name == "postgresql":
            conn.execute(text("ALTER TABLE order_production_assignments ADD COLUMN IF NOT EXISTS department_id UUID"))
            conn.execute(text("ALTER TABLE order_production_assignments ALTER COLUMN floor_id DROP NOT NULL"))
            conn.execute(text("ALTER TABLE order_production_assignments ALTER COLUMN line_id DROP NOT NULL"))
            conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS reference_attachments JSONB DEFAULT '[]'::jsonb"))
            conn.execute(text("ALTER TABLE order_attachments ADD COLUMN IF NOT EXISTS uploaded_by UUID"))
            conn.execute(text("ALTER TABLE vendors ADD COLUMN IF NOT EXISTS assigned_manager_id UUID"))
            conn.execute(text("ALTER TABLE sample_classes ADD COLUMN IF NOT EXISTS created_by UUID"))
            conn.execute(text("ALTER TABLE bulk_classes ADD COLUMN IF NOT EXISTS created_by UUID"))
            for old_name, new_name in legacy_stage_names.items():
                conn.execute(
                    text("UPDATE production_stages SET stage_name = :new_name WHERE stage_name = :old_name"),
                    {"new_name": new_name, "old_name": old_name},
                )
            conn.commit()
