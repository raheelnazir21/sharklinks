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
            assignment_cols = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(order_production_assignments)")).fetchall()
            }
            if "department_id" not in assignment_cols:
                conn.execute(text("ALTER TABLE order_production_assignments ADD COLUMN department_id CHAR(36)"))
            order_cols = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(orders)")).fetchall()
            }
            if "reference_attachments" not in order_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN reference_attachments JSON"))
            for old_name, new_name in legacy_stage_names.items():
                conn.execute(
                    text("UPDATE production_stages SET stage_name = :new_name WHERE stage_name = :old_name"),
                    {"new_name": new_name, "old_name": old_name},
                )
            conn.commit()
        elif engine.dialect.name == "postgresql":
            conn.execute(text("ALTER TABLE order_production_assignments ADD COLUMN IF NOT EXISTS department_id UUID"))
            conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS reference_attachments JSONB DEFAULT '[]'::jsonb"))
            for old_name, new_name in legacy_stage_names.items():
                conn.execute(
                    text("UPDATE production_stages SET stage_name = :new_name WHERE stage_name = :old_name"),
                    {"new_name": new_name, "old_name": old_name},
                )
            conn.commit()
