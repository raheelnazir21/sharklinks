"""
Tests for Authentication, Security, and RBAC.
"""
from app.models.user import RoleEnum, User, Role
from app.core.security import hash_password

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

def test_login_success(client, db):
    email = "admin@test.com"
    password = "password123"
    create_test_user(db, email, password, RoleEnum.super_admin)
    
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "access_token" in data["data"]
    assert data["data"]["user"]["email"] == email

def test_login_wrong_password(client, db):
    email = "user@test.com"
    create_test_user(db, email, "correct_pass", RoleEnum.viewer)
    
    response = client.post("/api/v1/auth/login", json={"email": email, "password": "wrong_pass"})
    assert response.status_code == 401
    assert "Invalid" in response.json()["detail"]

def test_missing_required_fields(client):
    response = client.post("/api/v1/auth/login", json={"email": "missing@pass.com"})
    assert response.status_code == 422 # Pydantic validation error

def test_rbac_restriction(client, db):
    # Create a viewer (who should NOT be able to create clients)
    email = "viewer@test.com"
    create_test_user(db, email, "pass", RoleEnum.viewer)
    
    # Login as viewer
    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": "pass"})
    token = login_res.json()["data"]["access_token"]
    
    # Attempt to create a client
    response = client.post(
        "/api/v1/clients/", 
        json={"name": "Restricted Client"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403 # Forbidden
    assert "Access denied" in response.json()["detail"]

def test_token_refresh(client, db):
    email = "refresh@test.com"
    user = create_test_user(db, email, "pass", RoleEnum.admin)
    
    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": "pass"})
    refresh_token = login_res.json()["data"]["refresh_token"]
    
    response = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    assert "access_token" in response.json()["data"]
