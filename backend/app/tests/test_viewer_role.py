import pytest
from app.models.user import RoleEnum, User, Role
from app.core.security import create_access_token, hash_password

def create_test_user(db, email, password, role_name: RoleEnum):
    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        role = Role(name=role_name, description=f"{role_name.value} role")
        db.add(role)
        db.commit()
    
    user = User(
        email=email,
        full_name=f"Test {role_name.value}",
        password_hash=hash_password(password),
        role_id=role.id,
        is_active=True
    )
    db.add(user)
    db.commit()
    return user

def test_viewer_company_wide_read_and_mutation_block(client, db):
    """
    Verify that a user with RoleEnum.viewer:
    - CAN read all company data (vendors, orders, classes)
    - CANNOT perform any mutations (returns 403 Forbidden)
    """
    test_user = create_test_user(db, "viewer@company.com", "viewerpass", RoleEnum.viewer)
    viewer_token = create_access_token(
        data={"sub": str(test_user.id), "role": RoleEnum.viewer.value, "vendor_id": None}
    )
    headers = {"Authorization": f"Bearer {viewer_token}"}

    # 1. READ Vendors: Should succeed (200 OK)
    resp = client.get("/api/v1/vendors/", headers=headers)
    assert resp.status_code == 200, f"Expected 200 for viewer listing vendors, got {resp.status_code}: {resp.text}"

    # 2. WRITE Vendor: Should be forbidden (403)
    resp = client.post(
        "/api/v1/vendors/",
        headers=headers,
        json={"name": "Forbidden Vendor", "code": "FV-01", "country": "US"}
    )
    assert resp.status_code == 403, f"Expected 403 for viewer creating vendor, got {resp.status_code}"

    # 3. READ Sample Classes: Should succeed (200 OK)
    resp = client.get("/api/v1/orders/sample-classes", headers=headers)
    assert resp.status_code == 200, f"Expected 200 for viewer listing sample classes, got {resp.status_code}"

    # 4. WRITE Sample Class: Should be forbidden (403)
    resp = client.post(
        "/api/v1/orders/sample-classes",
        headers=headers,
        json={"name": "Test Class", "serial_number": "TC-01"}
    )
    assert resp.status_code == 403, f"Expected 403 for viewer creating sample class, got {resp.status_code}"

    # 5. READ Orders: Should succeed (200 OK)
    resp = client.get("/api/v1/orders/", headers=headers)
    assert resp.status_code == 200, f"Expected 200 for viewer listing orders, got {resp.status_code}"

    # 6. WRITE Order: Should be forbidden (403)
    resp = client.post(
        "/api/v1/orders/",
        headers=headers,
        json={"order_no": "ORD-FORBIDDEN", "track_type": "sampling"}
    )
    assert resp.status_code == 403, f"Expected 403 for viewer creating order, got {resp.status_code}"

    # 7. READ QC Reports: Should succeed (200 OK)
    resp = client.get("/api/v1/qc-reports/", headers=headers)
    assert resp.status_code == 200, f"Expected 200 for viewer listing qc reports, got {resp.status_code}"

    # 8. READ Activity Logs: Should succeed (200 OK)
    resp = client.get("/api/v1/activity-logs/", headers=headers)
    assert resp.status_code == 200, f"Expected 200 for viewer listing activity logs, got {resp.status_code}"
