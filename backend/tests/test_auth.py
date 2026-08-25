"""Authentication flow: register, login, /me, and token enforcement."""

from conftest import DEMO_DOCTOR


def test_health(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_register_returns_token_and_profile(client):
    res = client.post("/api/v1/auth/register", json={
        **DEMO_DOCTOR,
        "username": "second.doctor",
        "email": "second.doctor@example.org",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["username"] == "second.doctor"
    assert body["hospital"] == "Test Hospital"


def test_register_duplicate_username_rejected(client):
    res = client.post("/api/v1/auth/register", json={
        **DEMO_DOCTOR,
        "email": "different-email@example.org",
    })
    assert res.status_code == 400
    assert "already registered" in res.json()["detail"]


def test_login_success(client):
    res = client.post("/api/v1/auth/login", json={
        "username": DEMO_DOCTOR["username"],
        "password": DEMO_DOCTOR["password"],
    })
    assert res.status_code == 200
    assert res.json()["access_token"]


def test_login_wrong_password(client):
    res = client.post("/api/v1/auth/login", json={
        "username": DEMO_DOCTOR["username"],
        "password": "wrong-password",
    })
    assert res.status_code == 401


def test_me_requires_token(client):
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401


def test_me_returns_profile(client, auth_headers):
    res = client.get("/api/v1/auth/me", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["username"] == DEMO_DOCTOR["username"]
    assert body["full_name"] == DEMO_DOCTOR["full_name"]
    assert body["hospital"] == DEMO_DOCTOR["hospital"]
