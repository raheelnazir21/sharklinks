"""
Tests for Business Logic: Relationships, Calculations, and History.
"""
from app.models.user import RoleEnum
from app.models.order import Client, Order, OrderStatus, StageName, StageStatus
from app.models.qc_report import QCReportType, DefectSeverity
from .test_auth import create_test_user
import uuid

def get_admin_token(client, db):
    email = f"admin_{uuid.uuid4()}@test.com"
    create_test_user(db, email, "pass", RoleEnum.super_admin)
    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": "pass"})
    return login_res.json()["data"]["access_token"]

def test_client_order_relationship(client, db):
    token = get_admin_token(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Create Client
    c_res = client.post("/api/v1/clients/", json={"name": "Textile Buyer Co"}, headers=headers)
    client_id = c_res.json()["data"]["id"]
    
    # 2. Create multiple orders for same client
    client.post("/api/v1/orders/", json={
        "client_id": client_id, "order_no": "PO-101", "quantity": 1000
    }, headers=headers)
    client.post("/api/v1/orders/", json={
        "client_id": client_id, "order_no": "PO-102", "quantity": 2000
    }, headers=headers)
    
    # Verify via API
    list_res = client.get("/api/v1/clients/", headers=headers)
    clients = list_res.json()["data"]
    target = next(c for c in clients if c["id"] == client_id)
    assert target["total_orders"] == 2

def test_qc_calculation_logic(client, db):
    token = get_admin_token(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    
    # Setup: Client & Order
    c_res = client.post("/api/v1/clients/", json={"name": "QC Test Client"}, headers=headers)
    cid = c_res.json()["data"]["id"]
    o_res = client.post("/api/v1/orders/", json={"client_id": cid, "order_no": "QC-99", "quantity": 100}, headers=headers)
    oid = o_res.json()["data"]["id"]
    
    # Setup: Defect Code
    d_res = client.post("/api/v1/qc-reports/defect-codes", json={
        "code": "B-01", "description": "Broken Stitch", "severity": "major"
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
        "report_type": "inline",
        "total_pieces": 100,
        "pass_pieces": 90,
        "fail_pieces": 10,
        "items": [
            {"defect_code_id": def_id, "quantity": 15, "stage": "Stitching"}
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
    
    # Create Order
    c_res = client.post("/api/v1/clients/", json={"name": "History Client"}, headers=headers)
    cid = c_res.json()["data"]["id"]
    o_res = client.post("/api/v1/orders/", json={"client_id": cid, "order_no": "HIST-1", "quantity": 500}, headers=headers)
    oid = o_res.json()["data"]["id"]
    
    # Update Order Status to in_progress
    client.put(f"/api/v1/orders/{oid}", json={"status": "in_progress"}, headers=headers)
    
    # Check History (In a real app, we'd have a history API. Here we check DB model directly or via detail API)
    # Since we haven't exposed a history API yet, this test verifies the logic in OrderService works.
    order = db.query(Order).filter(Order.id == oid).first()
    assert len(order.history) >= 2 # "created" and "status_changed"
    assert order.history[1].action == "status_changed"
    assert order.history[1].new_value["status"] == "in_progress"
