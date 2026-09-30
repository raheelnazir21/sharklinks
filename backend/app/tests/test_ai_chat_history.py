"""
Tests for AI Chat History Isolation.
Ensures chat history is strictly private and scoped to the authenticated user.
"""
import uuid
import pytest
from app.models.user import User, Role, RoleEnum
from app.models.ai_chat import AIChatSession, AIChatMessage
from app.core.security import create_access_token, hash_password


def create_test_user(db, email, role_name: RoleEnum):
    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        role = Role(name=role_name, description=f"{role_name.value} role")
        db.add(role)
        db.commit()

    user = User(
        email=email,
        full_name=f"Test {email}",
        password_hash=hash_password("password123"),
        role_id=role.id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_ai_chat_history_strict_user_isolation(client, db):
    # 1. Create two separate users
    user_a = create_test_user(db, "alice_chat@test.com", RoleEnum.manager)
    user_b = create_test_user(db, "bob_chat@test.com", RoleEnum.manager)

    token_a = create_access_token(data={"sub": str(user_a.id), "role": RoleEnum.manager.value})
    token_b = create_access_token(data={"sub": str(user_b.id), "role": RoleEnum.manager.value})

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 2. User A creates a chat session
    res_a = client.post("/api/v1/ai/sessions", json={"title": "Alice Secret Project"}, headers=headers_a)
    assert res_a.status_code == 200
    session_a_id = res_a.json()["data"]["id"]

    # User B creates a chat session
    res_b = client.post("/api/v1/ai/sessions", json={"title": "Bob Audit Notes"}, headers=headers_b)
    assert res_b.status_code == 200
    session_b_id = res_b.json()["data"]["id"]

    # 3. User A lists sessions -> should ONLY see Alice Secret Project, NOT Bob's
    list_a = client.get("/api/v1/ai/sessions", headers=headers_a)
    assert list_a.status_code == 200
    titles_a = [s["title"] for s in list_a.json()["data"]]
    ids_a = [s["id"] for s in list_a.json()["data"]]
    assert "Alice Secret Project" in titles_a
    assert "Bob Audit Notes" not in titles_a
    assert session_b_id not in ids_a

    # 4. User B lists sessions -> should ONLY see Bob's, NOT Alice's
    list_b = client.get("/api/v1/ai/sessions", headers=headers_b)
    assert list_b.status_code == 200
    titles_b = [s["title"] for s in list_b.json()["data"]]
    ids_b = [s["id"] for s in list_b.json()["data"]]
    assert "Bob Audit Notes" in titles_b
    assert "Alice Secret Project" not in titles_b
    assert session_a_id not in ids_b

    # 5. User B tries to directly access User A's session -> must return 404 (strictly blocked)
    snoop_res = client.get(f"/api/v1/ai/sessions/{session_a_id}", headers=headers_b)
    assert snoop_res.status_code == 404

    # 6. User B tries to delete User A's session -> must return 404
    delete_snoop = client.delete(f"/api/v1/ai/sessions/{session_a_id}", headers=headers_b)
    assert delete_snoop.status_code == 404

    # 7. User A can successfully retrieve their own session
    view_a = client.get(f"/api/v1/ai/sessions/{session_a_id}", headers=headers_a)
    assert view_a.status_code == 200
    assert view_a.json()["data"]["title"] == "Alice Secret Project"

    # 8. User A clears all history -> only Alice's sessions are cleared, Bob's remains intact
    clear_a = client.delete("/api/v1/ai/sessions", headers=headers_a)
    assert clear_a.status_code == 200

    after_clear_a = client.get("/api/v1/ai/sessions", headers=headers_a)
    assert len(after_clear_a.json()["data"]) == 0

    after_clear_b = client.get("/api/v1/ai/sessions", headers=headers_b)
    assert len(after_clear_b.json()["data"]) == 1
    assert after_clear_b.json()["data"][0]["id"] == session_b_id
