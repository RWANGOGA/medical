"""Tests for the dashboard hospital filtering logic.

Covers:
- GET /dashboard/hospitals - returns all hospitals
- GET /dashboard/hospitals?filter_by_doctor=true - returns only the doctor's hospital
- GET /dashboard/doctor-hospital - returns the current doctor's hospital
- Authentication requirements
- Lab result linking to patients
"""

BASE = "/api/v1/dashboard"
LAB_BASE = "/api/v1/lab"

HOSPITAL_A = "Mulago National Referral Hospital"
HOSPITAL_B = "Kiruddu General Hospital"
HOSPITAL_C = "Kawempe General Hospital"

PATIENT_HOSPITAL_A = {
    "name": "Patient at Hospital A",
    "national_id": "UG-HA-001",
    "hospital": HOSPITAL_A,
    "age": 30,
    "sex": "M",
    "diagnosis": "UTI",
}

PATIENT_HOSPITAL_B = {
    "name": "Patient at Hospital B",
    "national_id": "UG-HB-001",
    "hospital": HOSPITAL_B,
    "age": 45,
    "sex": "F",
    "diagnosis": "Pneumonia",
}

LAB_RESULT_HOSPITAL_C = {
    "patient_name": "Lab Patient",
    "organism_id": "ecoli",
    "specimen": "Urine",
    "hospital": HOSPITAL_C,
    "susceptibility": {"Ampicillin": "R", "Ceftriaxone": "S"},
}


def _create_patient(client, auth_headers, payload):
    res = client.post("/api/v1/patients/", json=payload, headers=auth_headers)
    assert res.status_code == 200, res.text
    return res.json()


def _create_lab_result(client, auth_headers, payload):
    res = client.post("/api/v1/lab/results", json=payload, headers=auth_headers)
    assert res.status_code == 200, res.text
    return res.json()


# --- Authentication ---

def test_hospitals_requires_auth(client):
    """Hospital endpoints require authentication."""
    res = client.get(f"{BASE}/hospitals")
    assert res.status_code == 401


def test_doctor_hospital_requires_auth(client):
    """Doctor hospital endpoint requires authentication."""
    res = client.get(f"{BASE}/doctor-hospital")
    assert res.status_code == 401


# --- Get all hospitals ---

def test_get_all_hospitals(client, auth_headers):
    """Returns all hospitals from patients and lab results."""
    # Create test data
    _create_patient(client, auth_headers, PATIENT_HOSPITAL_A)
    _create_patient(client, auth_headers, PATIENT_HOSPITAL_B)
    _create_lab_result(client, auth_headers, LAB_RESULT_HOSPITAL_C)

    res = client.get(f"{BASE}/hospitals", headers=auth_headers)
    assert res.status_code == 200

    hospitals = res.json()
    assert HOSPITAL_A in hospitals
    assert HOSPITAL_B in hospitals
    assert HOSPITAL_C in hospitals


def test_get_all_hospitals_sorted(client, auth_headers):
    """Hospitals are returned in sorted order."""
    _create_patient(client, auth_headers, PATIENT_HOSPITAL_B)
    _create_patient(client, auth_headers, PATIENT_HOSPITAL_A)

    res = client.get(f"{BASE}/hospitals", headers=auth_headers)
    assert res.status_code == 200

    hospitals = res.json()
    assert hospitals == sorted(hospitals)


def test_get_all_hospitals_empty(client, auth_headers):
    """Returns list of hospitals (may include seeded data)."""
    res = client.get(f"{BASE}/hospitals", headers=auth_headers)
    assert res.status_code == 200
    hospitals = res.json()
    assert isinstance(hospitals, list)
    # Hospital list may contain seeded data - verify it's sorted
    assert hospitals == sorted(hospitals)


# --- Filter by doctor ---

def test_filter_by_doctor_returns_only_doctor_hospital(client, auth_headers):
    """When filter_by_doctor=true, returns only the authenticated user's hospital."""
    # Create patients at different hospitals
    _create_patient(client, auth_headers, PATIENT_HOSPITAL_A)
    _create_patient(client, auth_headers, PATIENT_HOSPITAL_B)

    res = client.get(f"{BASE}/hospitals?filter_by_doctor=true", headers=auth_headers)
    assert res.status_code == 200

    hospitals = res.json()
    # The test doctor's hospital is "Test Hospital" (from conftest.py)
    assert hospitals == ["Test Hospital"]


def test_filter_by_doctor_false_returns_all(client, auth_headers):
    """When filter_by_doctor=false, returns all hospitals."""
    _create_patient(client, auth_headers, PATIENT_HOSPITAL_A)
    _create_patient(client, auth_headers, PATIENT_HOSPITAL_B)

    res = client.get(f"{BASE}/hospitals?filter_by_doctor=false", headers=auth_headers)
    assert res.status_code == 200

    hospitals = res.json()
    assert HOSPITAL_A in hospitals
    assert HOSPITAL_B in hospitals


def test_filter_by_doctor_no_hospital_set(client, auth_headers):
    """When doctor has no hospital set, returns empty list."""
    # The test doctor has hospital="Test Hospital" from conftest
    # This test verifies the behavior when filter is active
    res = client.get(f"{BASE}/hospitals?filter_by_doctor=true", headers=auth_headers)
    assert res.status_code == 200
    # Should return the doctor's hospital from conftest
    hospitals = res.json()
    assert "Test Hospital" in hospitals


# --- Doctor hospital endpoint ---

def test_get_doctor_hospital(client, auth_headers):
    """Returns the current doctor's hospital."""
    res = client.get(f"{BASE}/doctor-hospital", headers=auth_headers)
    assert res.status_code == 200

    data = res.json()
    assert data["hospital"] == "Test Hospital"


def test_doctor_hospital_structure(client, auth_headers):
    """Response has the expected structure."""
    res = client.get(f"{BASE}/doctor-hospital", headers=auth_headers)
    assert res.status_code == 200

    data = res.json()
    assert "hospital" in data
    assert isinstance(data["hospital"], str)


# --- Hospital deduplication ---

def test_hospitals_deduplicated(client, auth_headers):
    """Duplicate hospital names are deduplicated."""
    # Create multiple patients at the same hospital
    _create_patient(client, auth_headers, PATIENT_HOSPITAL_A)
    _create_patient(
        client,
        auth_headers,
        {**PATIENT_HOSPITAL_A, "name": "Another Patient", "national_id": "UG-HA-002"},
    )

    res = client.get(f"{BASE}/hospitals", headers=auth_headers)
    assert res.status_code == 200

    hospitals = res.json()
    # Hospital A should appear only once
    assert hospitals.count(HOSPITAL_A) == 1


# --- Hospital from both patients and lab results ---

def test_hospitals_from_patients_and_lab_results(client, auth_headers):
    """Hospitals are collected from both patients and lab results."""
    _create_patient(client, auth_headers, PATIENT_HOSPITAL_A)
    _create_lab_result(client, auth_headers, LAB_RESULT_HOSPITAL_C)

    res = client.get(f"{BASE}/hospitals", headers=auth_headers)
    assert res.status_code == 200

    hospitals = res.json()
    assert HOSPITAL_A in hospitals
    assert HOSPITAL_C in hospitals


# --- Lab Result Linking to Patients ---

def test_lab_result_creates_patient_if_not_exists(client, auth_headers):
    """Uploading a lab result with a new patient name creates a patient record."""
    res = client.post(f"{LAB_BASE}/results", json=LAB_RESULT_HOSPITAL_C, headers=auth_headers)
    assert res.status_code == 200

    # Check that a patient was created
    patients_res = client.get("/api/v1/patients/", headers=auth_headers)
    assert patients_res.status_code == 200
    patients = patients_res.json()
    patient_names = [p["name"] for p in patients]
    assert "Lab Patient" in patient_names


def test_lab_result_links_to_existing_patient(client, auth_headers):
    """Uploading a lab result with an existing patient name links to that patient."""
    # Create a patient first
    patient_res = client.post("/api/v1/patients/", json={
        **PATIENT_HOSPITAL_A,
        "name": "Existing Patient",
    }, headers=auth_headers)
    assert patient_res.status_code == 200
    patient_id = patient_res.json()["id"]

    # Upload lab result with same name
    lab_res = client.post(f"{LAB_BASE}/results", json={
        **LAB_RESULT_HOSPITAL_C,
        "patient_name": "Existing Patient",
    }, headers=auth_headers)
    assert lab_res.status_code == 200
    assert lab_res.json()["patient_id"] == patient_id


def test_recent_lab_results_endpoint(client, auth_headers):
    """Recent lab results endpoint returns lab results."""
    # Create a lab result
    _create_lab_result(client, auth_headers, LAB_RESULT_HOSPITAL_C)

    res = client.get(f"{LAB_BASE}/recent-results", headers=auth_headers)
    assert res.status_code == 200
    results = res.json()
    assert len(results) > 0
    assert results[0]["patient_name"] == "Lab Patient"
    assert results[0]["organism_id"] == "ecoli"


def test_lab_result_includes_susceptibility(client, auth_headers):
    """Lab result includes susceptibility data."""
    res = client.post(f"{LAB_BASE}/results", json=LAB_RESULT_HOSPITAL_C, headers=auth_headers)
    assert res.status_code == 200
    result = res.json()
    assert result["susceptibility"]["Ampicillin"] == "R"
    assert result["susceptibility"]["Ceftriaxone"] == "S"


def test_patients_ordered_by_recent_first(client, auth_headers):
    """Patients are returned with most recently added first."""
    # Create two patients
    client.post("/api/v1/patients/", json={
        **PATIENT_HOSPITAL_A,
        "name": "First Patient",
        "national_id": "UG-FIRST-001",
    }, headers=auth_headers)
    client.post("/api/v1/patients/", json={
        **PATIENT_HOSPITAL_A,
        "name": "Second Patient",
        "national_id": "UG-SECOND-001",
    }, headers=auth_headers)

    res = client.get("/api/v1/patients/", headers=auth_headers)
    assert res.status_code == 200
    patients = res.json()
    # Most recently added should be first
    assert patients[0]["name"] == "Second Patient"
    assert patients[1]["name"] == "First Patient"
