"""Audit trail: patient creation and PUT edits must be logged automatically
by the SQLAlchemy event listeners in services/audit.py."""

AUDIT = "/api/v1/audit/"


def test_audit_requires_auth(client):
    assert client.get(AUDIT).status_code == 401


def test_patient_create_and_update_are_audited(client, auth_headers):
    # Create a patient, then edit it via the PUT endpoint
    created = client.post("/api/v1/patients/", json={
        "name": "Ssebunya Allan",
        "age": 61,
        "sex": "M",
        "diagnosis": "Skin and soft tissue infection",
    }, headers=auth_headers).json()

    res = client.put(
        f"/api/v1/patients/{created['id']}",
        json={"diagnosis": "Cellulitis, resolving"},
        headers=auth_headers,
    )
    assert res.status_code == 200

    logs = client.get(f"{AUDIT}?limit=100", headers=auth_headers).json()
    patient_logs = [l for l in logs if l["patient_id"] == created["id"]]

    actions = [l["action"] for l in patient_logs]
    assert "created patient" in actions
    assert "updated patient" in actions

    # The edit log must be attributed to the authenticated test user
    update_log = next(l for l in patient_logs if l["action"] == "updated patient")
    assert update_log["username"] == "test.doctor"
    assert "Ssebunya Allan" in update_log["details"]
