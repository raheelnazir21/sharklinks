from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.models.order import (
    LocationStatus,
    OrderPriority,
    OrderStatus,
    StageName,
    StageStatus,
    StageApprovalStatus,
    TrackType,
)


POSTGRES_ENUMS = {
    "stagename": StageName,
    "locationstatus": LocationStatus,
    "tracktype": TrackType,
    "stagestatus": StageStatus,
    "orderstatus": OrderStatus,
    "orderpriority": OrderPriority,
    "stageapprovalstatus": StageApprovalStatus,
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
            if "vendor_id" not in bulk_class_cols:
                conn.execute(text("ALTER TABLE bulk_classes ADD COLUMN vendor_id CHAR(36)"))
            if "parent_id" not in order_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN parent_id CHAR(36)"))
            if "delay_reason" not in order_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN delay_reason TEXT"))
            if "delay_capa" not in order_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN delay_capa TEXT"))
            if "recovery_date" not in order_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN recovery_date DATE"))
            
            # --- Chunks schema updates for SQLite ---
            # Check if production_stage_chunks exists
            table_check = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='production_stage_chunks'")).scalar()
            if not table_check:
                conn.execute(text("""
                    CREATE TABLE production_stage_chunks (
                        id CHAR(36) NOT NULL PRIMARY KEY,
                        order_id CHAR(36) NOT NULL,
                        name VARCHAR(200) NOT NULL,
                        target_days INTEGER NOT NULL DEFAULT 1,
                        buffer_days INTEGER DEFAULT 0,
                        start_date DATETIME,
                        target_date DATETIME,
                        completion_date DATETIME
                    )
                """))
            else:
                chunk_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(production_stage_chunks)")).fetchall()}
                if "buffer_days" not in chunk_cols:
                    conn.execute(text("ALTER TABLE production_stage_chunks ADD COLUMN buffer_days INTEGER DEFAULT 0"))
            # Check if chunk_id and approval columns exist in production_stages
            ps_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(production_stages)")).fetchall()}
            if "chunk_id" not in ps_cols:
                conn.execute(text("ALTER TABLE production_stages ADD COLUMN chunk_id CHAR(36)"))
            if "approval_status" not in ps_cols:
                conn.execute(text("ALTER TABLE production_stages ADD COLUMN approval_status VARCHAR(50)"))
            if "conditional_action" not in ps_cols:
                conn.execute(text("ALTER TABLE production_stages ADD COLUMN conditional_action TEXT"))
            if "rejection_reason" not in ps_cols:
                conn.execute(text("ALTER TABLE production_stages ADD COLUMN rejection_reason TEXT"))
            if "corrective_action" not in ps_cols:
                conn.execute(text("ALTER TABLE production_stages ADD COLUMN corrective_action TEXT"))
            if "revised_target_date" not in ps_cols:
                conn.execute(text("ALTER TABLE production_stages ADD COLUMN revised_target_date DATETIME"))
            if "buffer_days" not in ps_cols:
                conn.execute(text("ALTER TABLE production_stages ADD COLUMN buffer_days INTEGER DEFAULT 0"))
            if "condition_status" not in ps_cols:
                conn.execute(text("ALTER TABLE production_stages ADD COLUMN condition_status VARCHAR(50)"))
            if "gated_stage_name" not in ps_cols:
                conn.execute(text("ALTER TABLE production_stages ADD COLUMN gated_stage_name VARCHAR(100)"))
            if "condition_cleared_at" not in ps_cols:
                conn.execute(text("ALTER TABLE production_stages ADD COLUMN condition_cleared_at DATETIME"))
            if "condition_cleared_by" not in ps_cols:
                conn.execute(text("ALTER TABLE production_stages ADD COLUMN condition_cleared_by CHAR(36)"))
            if "clearance_attachment_url" not in ps_cols:
                conn.execute(text("ALTER TABLE production_stages ADD COLUMN clearance_attachment_url VARCHAR(500)"))
            if "clearance_notes" not in ps_cols:
                conn.execute(text("ALTER TABLE production_stages ADD COLUMN clearance_notes TEXT"))

            # --- notifications schema updates for SQLite ---
            table_notif = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'")).scalar()
            if table_notif:
                notif_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(notifications)")).fetchall()}
                if "html_content" not in notif_cols:
                    conn.execute(text("ALTER TABLE notifications ADD COLUMN html_content TEXT"))
                if "category" not in notif_cols:
                    conn.execute(text("ALTER TABLE notifications ADD COLUMN category VARCHAR(50)"))
                if "class_id" not in notif_cols:
                    conn.execute(text("ALTER TABLE notifications ADD COLUMN class_id CHAR(36)"))
                if "extra_data" not in notif_cols:
                    conn.execute(text("ALTER TABLE notifications ADD COLUMN extra_data JSON"))

            # --- inline_qc_reports schema updates ---
            inline_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(inline_qc_reports)")).fetchall()}
            if "article_code" not in inline_cols:
                conn.execute(text("ALTER TABLE inline_qc_reports ADD COLUMN article_code VARCHAR(100)"))
            if "product_color" not in inline_cols:
                conn.execute(text("ALTER TABLE inline_qc_reports ADD COLUMN product_color VARCHAR(100)"))

            # --- finish_endline_qc_reports schema updates ---
            finish_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(finish_endline_qc_reports)")).fetchall()}
            if "article_code" not in finish_cols:
                conn.execute(text("ALTER TABLE finish_endline_qc_reports ADD COLUMN article_code VARCHAR(100)"))
            if "product_color" not in finish_cols:
                conn.execute(text("ALTER TABLE finish_endline_qc_reports ADD COLUMN product_color VARCHAR(100)"))

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
            conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES orders(id) ON DELETE SET NULL"))
            conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delay_reason TEXT"))
            conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delay_capa TEXT"))
            conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS recovery_date DATE"))
            conn.execute(text("ALTER TABLE order_attachments ADD COLUMN IF NOT EXISTS uploaded_by UUID"))
            conn.execute(text("ALTER TABLE vendors ADD COLUMN IF NOT EXISTS assigned_manager_id UUID"))
            conn.execute(text("ALTER TABLE sample_classes ADD COLUMN IF NOT EXISTS created_by UUID"))
            conn.execute(text("ALTER TABLE bulk_classes ADD COLUMN IF NOT EXISTS created_by UUID"))
            conn.execute(text("ALTER TABLE bulk_classes ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL"))
            conn.execute(text("ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50)"))
            conn.execute(text("ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS conditional_action TEXT"))
            conn.execute(text("ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS rejection_reason TEXT"))
            conn.execute(text("ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS corrective_action TEXT"))
            conn.execute(text("ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS revised_target_date TIMESTAMP"))
            conn.execute(text("ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS buffer_days INTEGER DEFAULT 0"))
            conn.execute(text("ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS condition_status VARCHAR(50)"))
            conn.execute(text("ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS gated_stage_name VARCHAR(100)"))
            conn.execute(text("ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS condition_cleared_at TIMESTAMP"))
            conn.execute(text("ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS condition_cleared_by UUID REFERENCES users(id) ON DELETE SET NULL"))
            conn.execute(text("ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS clearance_attachment_url VARCHAR(500)"))
            conn.execute(text("ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS clearance_notes TEXT"))

            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS html_content TEXT"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category VARCHAR(50)"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS class_id UUID"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'::jsonb"))
            
            # --- Chunks schema updates for Postgres ---
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS production_stage_chunks (
                    id UUID NOT NULL PRIMARY KEY,
                    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                    name VARCHAR(200) NOT NULL,
                    target_days INTEGER NOT NULL DEFAULT 1,
                    buffer_days INTEGER DEFAULT 0,
                    start_date TIMESTAMP,
                    target_date TIMESTAMP,
                    completion_date TIMESTAMP
                )
            """))
            conn.execute(text("ALTER TABLE production_stage_chunks ADD COLUMN IF NOT EXISTS buffer_days INTEGER DEFAULT 0"))
            conn.execute(text("ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS chunk_id UUID REFERENCES production_stage_chunks(id) ON DELETE SET NULL"))

            conn.execute(text("ALTER TABLE inline_qc_reports ADD COLUMN IF NOT EXISTS article_code VARCHAR(100)"))
            conn.execute(text("ALTER TABLE inline_qc_reports ADD COLUMN IF NOT EXISTS product_color VARCHAR(100)"))
            conn.execute(text("ALTER TABLE finish_endline_qc_reports ADD COLUMN IF NOT EXISTS article_code VARCHAR(100)"))
            conn.execute(text("ALTER TABLE finish_endline_qc_reports ADD COLUMN IF NOT EXISTS product_color VARCHAR(100)"))

            for old_name, new_name in legacy_stage_names.items():


                conn.execute(
                    text("UPDATE production_stages SET stage_name = CAST(:new_name AS stagename) WHERE stage_name::text = :old_name"),
                    {"new_name": new_name, "old_name": old_name},
                )
            conn.commit()
