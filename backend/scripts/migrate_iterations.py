import sqlite3
import os

db_path = "textile_qc.db"

def migrate():
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    columns_to_add = [
        ("current_iteration", "INTEGER DEFAULT 1"),
        ("iteration_reason", "TEXT"),
        ("iteration_plan", "TEXT"),
        ("iteration_history", "JSON DEFAULT '[]'")
    ]

    for col_name, col_def in columns_to_add:
        try:
            print(f"Adding column {col_name} to orders table...")
            cursor.execute(f"ALTER TABLE orders ADD COLUMN {col_name} {col_def}")
            print(f"Column {col_name} added successfully.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"Column {col_name} already exists.")
            else:
                print(f"Error adding column {col_name}: {e}")

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
