import psycopg2

conn = psycopg2.connect("postgresql://tronyx@localhost:5432/textile_qc")
cur = conn.cursor()

stmts = [
    """CREATE TABLE IF NOT EXISTS inline_qc_reports (
        id UUID PRIMARY KEY,
        floor VARCHAR(100),
        line_number VARCHAR(100),
        style_no VARCHAR(100),
        po_number VARCHAR(100),
        department VARCHAR(100),
        section VARCHAR(100),
        shift VARCHAR(50),
        qc_name VARCHAR(150),
        qc_code VARCHAR(50),
        inspection_level VARCHAR(50),
        aql_standard FLOAT DEFAULT 2.5,
        table_number VARCHAR(50),
        inspection_date DATE,
        total_checked_pcs INT DEFAULT 0,
        total_defects INT DEFAULT 0,
        total_minor INT DEFAULT 0,
        total_major INT DEFAULT 0,
        total_critical INT DEFAULT 0,
        dhu_percent FLOAT DEFAULT 0,
        overall_pass_pct FLOAT DEFAULT 0,
        overall_reject_pct FLOAT DEFAULT 0,
        aql_sample_size INT DEFAULT 0,
        aql_acceptance_qty INT DEFAULT 0,
        aql_rejection_qty INT DEFAULT 0,
        aql_observed INT DEFAULT 0,
        aql_result VARCHAR(20) DEFAULT 'pending',
        remarks TEXT,
        prepared_by VARCHAR(150),
        checked_by VARCHAR(150),
        approved_by VARCHAR(150),
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS inline_qc_operations (
        id UUID PRIMARY KEY,
        report_id UUID NOT NULL REFERENCES inline_qc_reports(id) ON DELETE CASCADE,
        op_order INT DEFAULT 1,
        operation_name VARCHAR(200) NOT NULL,
        operator_name VARCHAR(150),
        total_checked INT DEFAULT 0,
        total_defects INT DEFAULT 0,
        dhu_percent FLOAT DEFAULT 0,
        traffic_status VARCHAR(20) DEFAULT 'green'
    )""",
    """CREATE TABLE IF NOT EXISTS inline_qc_defect_rows (
        id UUID PRIMARY KEY,
        operation_id UUID NOT NULL REFERENCES inline_qc_operations(id) ON DELETE CASCADE,
        defect_name VARCHAR(200) NOT NULL,
        defect_id VARCHAR(50),
        severity VARCHAR(50) DEFAULT 'minor',
        hourly_data JSONB DEFAULT '[]',
        total_checked INT DEFAULT 0,
        total_defects INT DEFAULT 0,
        dhu_percent FLOAT DEFAULT 0
    )""",
    """CREATE TABLE IF NOT EXISTS operator_traffic_light_history (
        id UUID PRIMARY KEY,
        report_id UUID NOT NULL REFERENCES inline_qc_reports(id) ON DELETE CASCADE,
        operator_name VARCHAR(150) NOT NULL,
        operation_name VARCHAR(200),
        previous_status VARCHAR(20),
        current_status VARCHAR(20) NOT NULL,
        dhu_percent FLOAT DEFAULT 0,
        action_taken VARCHAR(300),
        remarks TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS finish_endline_qc_reports (
        id UUID PRIMARY KEY,
        report_type VARCHAR(20) DEFAULT 'finish',
        style_no VARCHAR(100),
        po_number VARCHAR(100),
        shift VARCHAR(50),
        line VARCHAR(100),
        qc_name VARCHAR(150),
        department VARCHAR(100),
        inspection_level VARCHAR(50),
        report_date DATE,
        aql_standard FLOAT DEFAULT 2.5,
        aql_sample_size INT DEFAULT 0,
        aql_acceptance INT DEFAULT 0,
        aql_rejection INT DEFAULT 0,
        aql_observed INT DEFAULT 0,
        aql_result VARCHAR(20) DEFAULT 'pending',
        total_pcs_inspected INT DEFAULT 0,
        total_defects INT DEFAULT 0,
        dhu_percent FLOAT DEFAULT 0,
        defect_columns JSONB DEFAULT '[]',
        remarks TEXT,
        prepared_by VARCHAR(150),
        checked_by VARCHAR(150),
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS finish_endline_qc_hourly_rows (
        id UUID PRIMARY KEY,
        report_id UUID NOT NULL REFERENCES finish_endline_qc_reports(id) ON DELETE CASCADE,
        row_order INT DEFAULT 1,
        hour_slot VARCHAR(50) NOT NULL,
        total_pcs INT DEFAULT 0,
        defect_counts JSONB DEFAULT '{}',
        total_defects INT DEFAULT 0,
        dhu_percent FLOAT DEFAULT 0
    )""",
]

try:
    for stmt in stmts:
        print(f"Running: {stmt[:60].strip()}...")
        cur.execute(stmt)
    conn.commit()
    print("\n✅ All advanced QC tables created successfully.")
except Exception as e:
    print(f"❌ Error: {e}")
    conn.rollback()
finally:
    cur.close()
    conn.close()
