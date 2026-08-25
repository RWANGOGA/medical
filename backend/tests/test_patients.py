"""Patient CRUD with emphasis on the new PUT /patients/{id} edit endpoint
and the duplicate-prevention checks used by the mobile "find first" flow."""

BASE = "/api/v1/patients"

NEW_PATIENT = {
    "name": "Akello Maria",
    "national_id": "UG-TEST-0001",
    "hospital": "Test Hospital",
    "age": 45,
    "sex": "F",
    "weight_kg": 60.5,
    "allergies": ["Penicillin"],
    "diagnosis": "Community-acquired pneumonia",
    "infection_site": "Lower respiratory tract",
    "culture_results": "S. pneumoniae",
    "antibiotic_timeline": [{"date": "2026", "drug": "Amoxicillin", "outcome": "current", "note": "Started empirically"}],
}


def _create_patient(client, auth_headers, **overrides):
    payload = {**NEW_PATIENT, **overrides}
    res = client.post(f"{BASE}/", json=payload, headers=auth_headers)
    assert res.status_code == 200, res.text
    return res.json()


# --- Access control ---

def test_list_requires_auth(client):
    assert client.get(f"{BASE}/").status_code == 401
    assert client.put(f"{BASE}/1", json={}).status_code == 401


# --- Create / read ---

def test_create_and_get_patient(client, auth_headers):
    created = _create_patient(client, auth_headers)
    assert created["id"]
    assert created["name"] == NEW_PATIENT["name"]
    assert created["allergies"] == ["Penicillin"]

    res = client.get(f"{BASE}/{created['id']}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["national_id"] == NEW_PATIENT["national_id"]


def test_get_missing_patient_returns_404(client, auth_headers):
    res = client.get(f"{BASE}/999999", headers=auth_headers)
    assert res.status_code == 404


# --- PUT update (edit-existing-record flow) ---

def test_update_patient_full_replace(client, auth_headers):
    created = _create_patient(client, auth_headers, name="Byansi John")
    updated = {
        "name": "Byansi John K",
        "age": 46,
        "sex": "M",
        "hospital": "Test Hospital Annex",
        "diagnosis": "Bacteremia",
        "allergies": ["Penicillin", "Sulfa"],
    }
    res = client.put(f"{BASE}/{created['id']}", json=updated, headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "Byansi John K"
    assert body["age"] == 46
    assert body["diagnosis"] == "Bacteremia"
    assert body["allergies"] == ["Penicillin", "Sulfa"]
    # Fields not included in the payload must be untouched
    assert body["national_id"] == NEW_PATIENT["national_id"]
    assert body["culture_results"] == NEW_PATIENT["culture_results"]


def test_update_patient_partial_keeps_other_fields(client, auth_headers):
    created = _create_patient(client, auth_headers, name="Chelangat Rose")
    res = client.put(
        f"{BASE}/{created['id']}",
        json={"diagnosis": "Complicated urinary tract infection"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["diagnosis"] == "Complicated urinary tract infection"
    assert body["name"] == "Chelangat Rose"
    assert body["age"] == NEW_PATIENT["age"]
    assert body["weight_kg"] == NEW_PATIENT["weight_kg"]


def test_update_missing_patient_returns_404(client, auth_headers):
    res = client.put(f"{BASE}/999999", json={"diagnosis": "x"}, headers=auth_headers)
    assert res.status_code == 404


# --- Duplicate prevention (check-duplicate endpoint) ---

def test_check_duplicate_high_risk_same_identity(client, auth_headers):
    _create_patient(client, auth_headers, name="Ddamulira Peter", age=50, sex="M")
    res = client.post(f"{BASE}/check-duplicate", json={
        "name": "Ddamulira Peter", "age": 50, "sex": "M",
    }, headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["is_duplicate"] is True
    assert body["risk_level"] == "high"


def test_check_duplicate_medium_risk_same_name_only(client, auth_headers):
    _create_patient(client, auth_headers, name="Ekwara Susan", age=30, sex="F")
    res = client.post(f"{BASE}/check-duplicate", json={
        "name": "Ekwara Susan", "age": 77, "sex": "M",
    }, headers=auth_headers)
    body = res.json()
    assert body["is_duplicate"] is True
    assert body["risk_level"] == "medium"


def test_check_duplicate_none_for_unknown_name(client, auth_headers):
    res = client.post(f"{BASE}/check-duplicate", json={
        "name": "Totally Unknown Person XYZ",
    }, headers=auth_headers)
    body = res.json()
    assert body["is_duplicate"] is False
    assert body["risk_level"] == "none"
    assert body["matches"] == []
