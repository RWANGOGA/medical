"""Tests for admin and publications functionality."""

import pytest

ADMIN_BASE = "/api/v1/admin"
PUB_BASE = "/api/v1/publications"

ADMIN_USER = {
    "username": "admin.test",
    "email": "admin.test@example.org",
    "password": "adminpass123",
    "full_name": "Test Admin",
    "role": "doctor",
    "hospital": "All Hospitals",
    "specialization": "Administration",
}


@pytest.fixture(scope="session")
def admin_headers(client):
    """Create a user, promote it to admin in the database, and return headers.

    Self-registration deliberately cannot create administrators, so the role is
    granted directly (the same way an operator would provision the first admin).
    """
    res = client.post("/api/v1/auth/register", json=ADMIN_USER)
    if res.status_code == 400:
        res = client.post("/api/v1/auth/login", json={
            "username": ADMIN_USER["username"],
            "password": ADMIN_USER["password"],
        })
    assert res.status_code == 200, res.text

    from sqlmodel import Session, select

    from app.db import engine
    from app.models import User

    with Session(engine) as session:
        user = session.exec(
            select(User).where(User.username == ADMIN_USER["username"])
        ).first()
        assert user is not None
        user.role = "admin"
        session.add(user)
        session.commit()

    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# --- Admin Auth Tests ---

def test_admin_dashboard_requires_admin(client, auth_headers):
    """Non-admin users cannot access admin dashboard."""
    res = client.get(f"{ADMIN_BASE}/dashboard", headers=auth_headers)
    assert res.status_code == 403


def test_admin_dashboard_accessible_by_admin(client, admin_headers):
    """Admin users can access dashboard."""
    res = client.get(f"{ADMIN_BASE}/dashboard", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_doctors" in data
    assert "total_patients" in data


def test_admin_can_list_doctors(client, admin_headers):
    """Admin can list all doctors."""
    res = client.get(f"{ADMIN_BASE}/doctors", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "doctors" in data
    assert isinstance(data["doctors"], list)


def test_admin_can_suspend_doctor(client, admin_headers):
    """Admin can suspend a doctor, then reactivate the account."""
    # Register a throw-away doctor so the shared test doctor stays usable.
    res = client.post("/api/v1/auth/register", json={
        "username": "suspend.me",
        "email": "suspend.me@example.org",
        "password": "suspend-pass-123",
        "full_name": "Suspendable Doctor",
        "role": "doctor",
        "hospital": "Test Hospital",
    })
    assert res.status_code == 200, res.text
    doctor_id = res.json()["user_id"]

    res = client.put(f"{ADMIN_BASE}/doctors/{doctor_id}/suspend", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "suspended"

    # A suspended account must not be able to log in.
    login = client.post("/api/v1/auth/login", json={
        "username": "suspend.me",
        "password": "suspend-pass-123",
    })
    assert login.status_code == 403

    res = client.put(f"{ADMIN_BASE}/doctors/{doctor_id}/activate", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "activated"


# --- Publications Tests ---

def test_create_publication_requires_admin(client, auth_headers):
    """Non-admin users cannot create publications."""
    res = client.post(f"{PUB_BASE}/", json={
        "title": "Test Publication",
        "description": "Test description",
        "content_type": "article",
    }, headers=auth_headers)
    assert res.status_code == 403


def test_admin_can_create_publication(client, admin_headers):
    """Admin can create a publication."""
    res = client.post(f"{PUB_BASE}/", json={
        "title": "New AMR Research Findings",
        "description": "Latest research on antimicrobial resistance",
        "content_type": "article",
        "category": "research",
        "tags": ["amr", "research", "2026"],
    }, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "New AMR Research Findings"
    assert "id" in data


def test_doctor_can_list_publications(client, admin_headers, auth_headers):
    """Doctors can list published publications."""
    # First create a publication as admin
    client.post(f"{PUB_BASE}/", json={
        "title": "Visible Publication",
        "description": "Should be visible to doctors",
        "content_type": "article",
        "category": "amr",
    }, headers=admin_headers)

    # Then list as doctor
    res = client.get(f"{PUB_BASE}/", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "publications" in data
    assert len(data["publications"]) > 0


def test_publication_search_and_filter(client, admin_headers, auth_headers):
    """Publications can be filtered by category."""
    # Create publications in different categories
    client.post(f"{PUB_BASE}/", json={
        "title": "AMR Article",
        "description": "About AMR",
        "content_type": "article",
        "category": "amr",
    }, headers=admin_headers)
    client.post(f"{PUB_BASE}/", json={
        "title": "Guidelines Article",
        "description": "About guidelines",
        "content_type": "article",
        "category": "guidelines",
    }, headers=admin_headers)

    # Filter by category
    res = client.get(f"{PUB_BASE}/?category=amr", headers=auth_headers)
    assert res.status_code == 200
    pubs = res.json()["publications"]
    assert all(p["category"] == "amr" for p in pubs)


def test_publication_with_url(client, admin_headers, auth_headers):
    """Publications can have external URLs."""
    res = client.post(f"{PUB_BASE}/", json={
        "title": "External Research Paper",
        "description": "Link to external research",
        "content_type": "url",
        "content_url": "https://example.com/research",
        "category": "research",
    }, headers=admin_headers)
    assert res.status_code == 200

    # Verify it appears in list
    res = client.get(f"{PUB_BASE}/", headers=auth_headers)
    pubs = res.json()["publications"]
    urls = [p["content_url"] for p in pubs]
    assert "https://example.com/research" in urls


def test_publication_view_counting(client, admin_headers, auth_headers):
    """Publication views are counted per user."""
    # Create a publication
    res = client.post(f"{PUB_BASE}/", json={
        "title": "View Count Test",
        "description": "Testing view count",
        "content_type": "article",
    }, headers=admin_headers)
    pub_id = res.json()["id"]

    # View it
    res = client.get(f"{PUB_BASE}/{pub_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["view_count"] >= 1


def test_publication_not_duplicated_view(client, admin_headers, auth_headers):
    """Same user viewing twice doesn't double count."""
    # Create a publication
    res = client.post(f"{PUB_BASE}/", json={
        "title": "No Dup View",
        "description": "Testing no duplicate views",
        "content_type": "article",
    }, headers=admin_headers)
    pub_id = res.json()["id"]

    # View it twice
    client.get(f"{PUB_BASE}/{pub_id}", headers=auth_headers)
    res = client.get(f"{PUB_BASE}/{pub_id}", headers=auth_headers)
    assert res.json()["view_count"] == 1  # Only counted once per user
