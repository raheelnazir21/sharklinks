import psycopg2
from urllib.parse import urlparse

DATABASE_URL = "postgresql://tronyx@localhost:5432/textile_qc"

def migrate():
    result = urlparse(DATABASE_URL)
    username = result.username
    password = result.password
    database = result.path[1:]
    hostname = result.hostname
    port = result.port

    conn = psycopg2.connect(
        database=database,
        user=username,
        password=password,
        host=hostname,
        port=port
    )
    cur = conn.cursor()

    try:
        # Add columns to orders
        print("Updating orders table...")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_id VARCHAR(100);")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS top_sample_status VARCHAR(50) DEFAULT 'pending';")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS qa_audit_status VARCHAR(50) DEFAULT 'pending';")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_target_days INTEGER DEFAULT 0;")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS current_iteration INTEGER DEFAULT 1;")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS iteration_reason TEXT;")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS iteration_plan TEXT;")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS iteration_history JSONB DEFAULT '[]'::jsonb;")
        
        # Create order_audits table
        print("Creating order_audits table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS order_audits (
                id UUID PRIMARY KEY,
                order_id UUID NOT NULL REFERENCES orders(id),
                before_photo VARCHAR(500),
                after_photo VARCHAR(500),
                documents JSONB DEFAULT '[]'::jsonb,
                new_po_number VARCHAR(100),
                new_vendor_id UUID REFERENCES vendors(id),
                is_moved_to_bulk BOOLEAN DEFAULT FALSE,
                moved_to_bulk_order_id UUID,
                is_shipped BOOLEAN DEFAULT FALSE,
                notes TEXT,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );
        """)
        
        # Add history relationship table if missing
        print("Creating order_history table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS order_history (
                id UUID PRIMARY KEY,
                order_id UUID NOT NULL REFERENCES orders(id),
                action VARCHAR(100) NOT NULL,
                changed_by UUID NOT NULL REFERENCES users(id),
                old_value JSON,
                new_value JSON,
                note TEXT,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );
        """)
        
        # Add updated_by to production_stages
        cur.execute("ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);")

        conn.commit()
        print("Migration successful.")
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    migrate()
