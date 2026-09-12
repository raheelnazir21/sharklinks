"""
Migration: Add vendor_id to bulk_classes, approval_status + conditional_action to production_stages.
Run: python migrate_new_features.py
"""
import sqlite3
import os

DB_PATHS = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "textile_qc.db"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "test.db"),
]

def column_exists(cursor, table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())

def run_migration(db_path: str):
    if not os.path.exists(db_path):
        print(f"  Skipping {db_path} — file not found.")
        return
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    if not column_exists(cur, "bulk_classes", "vendor_id"):
        cur.execute("ALTER TABLE bulk_classes ADD COLUMN vendor_id TEXT REFERENCES vendors(id)")
        print("  [+] bulk_classes.vendor_id added")
    else:
        print("  [=] bulk_classes.vendor_id already exists")
    if not column_exists(cur, "production_stages", "approval_status"):
        cur.execute("ALTER TABLE production_stages ADD COLUMN approval_status TEXT")
        print("  [+] production_stages.approval_status added")
    else:
        print("  [=] production_stages.approval_status already exists")
    if not column_exists(cur, "production_stages", "conditional_action"):
        cur.execute("ALTER TABLE production_stages ADD COLUMN conditional_action TEXT")
        print("  [+] production_stages.conditional_action added")
    else:
        print("  [=] production_stages.conditional_action already exists")
    conn.commit()
    conn.close()
    print(f"  Done: {db_path}")

if __name__ == "__main__":
    for path in DB_PATHS:
        print(f"\nMigrating: {path}")
        run_migration(path)
    print("\nMigration complete.")
