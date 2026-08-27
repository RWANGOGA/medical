"""Tests for admin and publications functionality."""

import pytest

ADMIN_BASE = "/api/v1/admin"
PUB_BASE = "/api/v1/publications"


@pytest.fixture(scope="session")
def admin_headers(client):
    """Register an admin user and return auth headers."""
    res = client.post("/api/v1/auth/register", json={
        "username": "admin.test",
        "email": "admin.test@example.org",
        "password": "adminpass123",
        "full_name": "Test Admin",
        "role": "admin",
        "hospital": "All Hospitals",
        "specialization": "Administration",
    })
    # If registration returns existing user, try login
    if res.status_code == 400:
        res = client.post("/api/v1/auth/login", json={
            "username": "admin.test",
            "password": "adminpass123",
        })
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


def test_admin_can_suspend_doctor(client, admin_headers, auth_headers):
    """Admin can suspend a doctor."""
    # First get a doctor to suspend
    res = client.get(f"{ADMIN_BASE}/doctors", headers=admin_headers)
    doctors = res.json()["doctors"]
    if doctors:
        doctor_id = doctors[0]["id"]
        res = client.put(f"{ADMIN_BASE}/doctors/{doctor_id}/suspend", headers=admin_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "suspended"


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
