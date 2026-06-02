"""
Tests for Business Logic: Relationships, Calculations, and History.
"""
from app.models.user import RoleEnum
from app.models.order import Vendor, Order, OrderStatus, StageName, StageStatus
from app.models.qc_report import QCReportType, DefectSeverity
from .test_auth import create_test_user
import uuid

def get_admin_token(client, db):
    email = f"admin_{uuid.uuid4()}@test.com"
    create_test_user(db, email, "pass", RoleEnum.super_admin)
    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": "pass"})
    return login_res.json()["data"]["access_token"]

def test_vendor_order_relationship(client, db):
    token = get_admin_token(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Create Vendor
    v_res = client.post("/api/v1/vendors/", json={"name": "Textile Vendor Co"}, headers=headers)
    assert v_res.status_code == 200, f"Vendor create failed: {v_res.text}"
    vendor_id = v_res.json()["data"]["id"]
    
    # 2. Create multiple orders for same vendor
    client.post("/api/v1/orders/", json={
        "vendor_id": vendor_id, "order_no": "PO-101", "quantity": 1000
    }, headers=headers)
    client.post("/api/v1/orders/", json={
        "vendor_id": vendor_id, "order_no": "PO-102", "quantity": 2000
    }, headers=headers)
    
    # Verify via API
    list_res = client.get("/api/v1/vendors/", headers=headers)
    vendors = list_res.json()["data"]
    target = next((v for v in vendors if v["id"] == vendor_id), None)
    assert target is not None, "Created vendor not found in list"

def test_qc_calculation_logic(client, db):
    token = get_admin_token(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    
    # Setup: Vendor & Order
    v_res = client.post("/api/v1/vendors/", json={"name": "QC Test Vendor"}, headers=headers)
    assert v_res.status_code == 200, f"Vendor create failed: {v_res.text}"
    vid = v_res.json()["data"]["id"]
    o_res = client.post("/api/v1/orders/", json={"vendor_id": vid, "order_no": "QC-99", "quantity": 100}, headers=headers)
    oid = o_res.json()["data"]["id"]
    
    # Setup: Defect Code — schema requires report_type + name + code
    d_res = client.post("/api/v1/qc-reports/defect-codes", json={
        "report_type": "inline", "name": "Broken Stitch", "code": "B-01", "severity": "major"
    }, headers=headers)
    if d_res.status_code != 200:
        print(f"Defect Create Error: {d_res.status_code} - {d_res.text}")
    
    codes_res = client.get("/api/v1/qc-reports/defect-codes", headers=headers)
    if codes_res.status_code != 200:
        print(f"Defect List Error: {codes_res.status_code} - {codes_res.text}")
    
    res_json = codes_res.json()
    if "data" not in res_json:
        print(f"Missing data key in response: {res_json}")
    def_id = res_json["data"][0]["id"]
    
    # Submit QC Report: 100 pieces, 90 pass, 10 fail, 15 defects total
    report_payload = {
        "order_id": oid,
        "vendor_id": vid,
        "report_type": "inline",
        "quantity_checked": 100,
        "quantity_passed": 90,
        "quantity_rejected": 10,
        "items": [
            {
                "operation": "Stitching",
                "defect_entries": [
                    {"defect_id": def_id, "defect_count": 15}
                ]
            }
        ]
    }
    r_res = client.post("/api/v1/qc-reports/", json=report_payload, headers=headers)
    if r_res.status_code != 200:
        print(f"Error Response: {r_res.json()}")
    assert r_res.status_code == 200
    data = r_res.json()["data"]
    
    # DHU = (15 / 100) * 100 = 15.0
    # FPY = (90 / 100) * 100 = 90.0
    assert "dhu_percent" in data, f"Key 'dhu_percent' missing from {data}"
    assert data["dhu_percent"] == 15.0
    assert data["fpy_percent"] == 90.0

def test_order_history_logging(client, db):
    token = get_admin_token(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create Order via Vendor
    v_res = client.post("/api/v1/vendors/", json={"name": "History Vendor"}, headers=headers)
    vid = v_res.json()["data"]["id"]
    o_res = client.post("/api/v1/orders/", json={"vendor_id": vid, "order_no": "HIST-1", "quantity": 500}, headers=headers)
    oid = o_res.json()["data"]["id"]
    
    # Update Order Status to in_progress
    client.put(f"/api/v1/orders/{oid}", json={"status": "in_progress"}, headers=headers)
    
    # Check History — update_order logs: 'created' (on create), then 'updated' + 'status_changed' (on update)
    # So: history[0]=created, history[1]=updated, history[2]=status_changed
    order = db.query(Order).filter(Order.id == oid).first()
    assert len(order.history) >= 3, f"Expected at least 3 history entries, got {len(order.history)}: {[h.action for h in order.history]}"
    status_changed = next((h for h in order.history if h.action == "status_changed"), None)
    assert status_changed is not None, "No 'status_changed' history entry found"
    assert status_changed.new_value["status"] == "in_progress"
