"""Regression tests for access-control hardening.

These cover the loopholes that were fixed:
- cross-hospital patient records must not be readable
- lab results must not be public
- audit trails must not expose other clinicians' activity
- clinical decision support must require authentication
"""

import pytest
from sqlmodel import Session, select

from app.db import engine
from app.models import User


@pytest.fixture(scope="module")
def admin_headers(client):
    payload = {
        "username": "security.admin",
        "email": "security.admin@example.org",
        "password": "security-admin-123",
        "full_name": "Security Admin",
        "role": "doctor",
        "hospital": "Network Office",
    }
    res = client.post("/api/v1/auth/register", json=payload)
    if res.status_code == 400:
        res = client.post("/api/v1/auth/login", json={
            "username": payload["username"],
            "password": payload["password"],
        })
    assert res.status_code == 200, res.text

    with Session(engine) as session:
        user = session.exec(
            select(User).where(User.username == payload["username"])
        ).first()
        user.role = "admin"
        session.add(user)
        session.commit()

    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_doctor_cannot_read_other_hospital_patient(client, auth_headers, admin_headers):
    created = client.post("/api/v1/patients/", json={
        "name": "Remote Hospital Patient",
        "national_id": "UG-REMOTE-001",
        "hospital": "Remote Regional Hospital",
        "age": 44,
        "sex": "F",
        "diagnosis": "Sepsis",
    }, headers=admin_headers)
    assert created.status_code == 200, created.text
    patient_id = created.json()["id"]

    res = client.get(f"/api/v1/patients/{patient_id}", headers=auth_headers)
    assert res.status_code == 403

    listing = client.get("/api/v1/patients/", headers=auth_headers)
    assert listing.status_code == 200
    names = [p["name"] for p in listing.json()]
    assert "Remote Hospital Patient" not in names


def test_doctor_can_read_patient_they_entered(client, auth_headers):
    created = client.post("/api/v1/patients/", json={
        "name": "Referred Patient",
        "national_id": "UG-REFERRAL-001",
        "hospital": "Referral Site",
        "age": 33,
        "sex": "M",
        "diagnosis": "Pneumonia",
    }, headers=auth_headers)
    assert created.status_code == 200, created.text
    patient_id = created.json()["id"]

    res = client.get(f"/api/v1/patients/{patient_id}", headers=auth_headers)
    assert res.status_code == 200


def test_lab_results_require_authentication(client):
    assert client.get("/api/v1/lab/results").status_code == 401
    assert client.get("/api/v1/lab/recent-results").status_code == 401


def test_cds_requires_authentication(client):
    res = client.post("/api/v1/cds/recommend", json={"organism_id": "ecoli"})
    assert res.status_code == 401


def test_public_hospital_filter_does_not_leak_doctor_scope(client):
    res = client.get("/api/v1/dashboard/hospitals?filter_by_doctor=true")
    assert res.status_code == 200
    assert res.json() == []


def test_monthly_report_requires_authentication(client):
    assert client.get("/api/v1/reports/monthly").status_code == 401


def test_monthly_report_is_scoped_to_the_caller(client, auth_headers):
    res = client.get("/api/v1/reports/monthly", headers=auth_headers)
    assert res.status_code == 200
    body = res.text
    assert "AMR STEWARDSHIP MONTHLY REPORT" in body
    # The caller is a Test Hospital clinician, so other sites must not appear.
    assert "Remote Regional Hospital" not in body
    assert "RECENT ACTIVITY" not in body


def test_audit_logs_scoped_to_current_user(client, auth_headers, admin_headers):
    # The admin performs an audited action, then a clinician must not see it.
    client.post("/api/v1/patients/", json={
        "name": "Audit Scoped Patient",
        "hospital": "Network Office",
        "age": 50,
        "sex": "M",
        "diagnosis": "UTI",
    }, headers=admin_headers)

    res = client.get("/api/v1/audit/", headers=auth_headers)
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list)
    usernames = {log["username"] for log in logs if log.get("username")}
    assert "security.admin" not in usernames
