"""WHO GLASS first-isolate methodology and surveillance data quality."""

import uuid

from sqlalchemy import inspect

from app.db import engine
from app.services.surveillance import (
    is_invasive,
    normalise_specimen,
    patient_key,
    quality_indicators,
)

BASE_LAB = "/api/v1/lab/results"
BASE_DASH = "/api/v1/dashboard"


def _name(prefix="GLASS Patient"):
    return f"{prefix} {uuid.uuid4().hex[:10]}"


def _post_isolate(client, auth_headers, **overrides):
    payload = {
        "patient_name": _name(),
        "organism_id": "ecoli",
        "specimen": "Urine",
        "hospital": "Test Hospital",
        "susceptibility": {"Nitrofurantoin": "R"},
    }
    payload.update(overrides)
    res = client.post(BASE_LAB, json=payload, headers=auth_headers)
    assert res.status_code == 200, res.text
    return res.json()


# --- Pure helpers ---

def test_patient_key_prefers_linked_id_and_is_stable():
    assert patient_key(42, "Any Name", "Any Hospital") == "pid:42"
    assert patient_key(None, "Namono J.", "Jinja Regional Hospital") == patient_key(
        None, "namono j", "jinja regional hospital"
    )


def test_specimen_normalisation_and_invasive_definition():
    assert normalise_specimen("Cerebrospinal fluid") == "csf"
    assert normalise_specimen("blood culture") == "blood"
    assert is_invasive("CSF")
    assert is_invasive("Blood culture")
    assert not is_invasive("Urine")


# --- First-isolate rule ---

def test_repeat_isolate_is_marked_duplicate_and_excluded_from_antibiogram(client, auth_headers):
    name = _name()
    hospital = f"Surveillance {uuid.uuid4().hex[:8]}"
    first = _post_isolate(
        client, auth_headers, patient_name=name, hospital=hospital,
        susceptibility={"Nitrofurantoin": "R"},
    )
    assert first["is_first_isolate"] is True
    assert first["infection_origin"] == "unknown"
    assert first["ast_standard"] == ""

    scope = f"hospital={hospital.replace(' ', '%20')}"
    before = client.get(f"{BASE_DASH}/antibiogram-stats?{scope}").json()
    n_before = before["cells"]["E. coli"]["Nitrofurantoin"]["n"]

    second = _post_isolate(
        client, auth_headers, patient_name=name, hospital=hospital,
        susceptibility={"Nitrofurantoin": "S"},
    )
    assert second["is_first_isolate"] is False
    assert second["duplicate_of"] == first["id"]

    after = client.get(f"{BASE_DASH}/antibiogram-stats?{scope}").json()
    assert after["cells"]["E. coli"]["Nitrofurantoin"]["n"] == n_before
    assert after["cells"]["E. coli"]["Nitrofurantoin"]["r"] == before["cells"]["E. coli"]["Nitrofurantoin"]["r"]

    included = client.get(
        f"{BASE_DASH}/antibiogram-stats?{scope}&include_duplicates=true"
    ).json()
    assert included["cells"]["E. coli"]["Nitrofurantoin"]["n"] == n_before + 1


def test_different_specimen_is_a_new_episode(client, auth_headers):
    name = _name()
    first = _post_isolate(client, auth_headers, patient_name=name, specimen="Urine")
    second = _post_isolate(client, auth_headers, patient_name=name, specimen="Blood")
    assert first["is_first_isolate"] is True
    assert second["is_first_isolate"] is True


def test_old_isolate_outside_window_is_a_new_episode(client, auth_headers):
    name = _name()
    _post_isolate(
        client, auth_headers, patient_name=name, collection_date="2020-01-01"
    )
    newer = _post_isolate(
        client, auth_headers, patient_name=name, collection_date="2026-01-01"
    )
    assert newer["is_first_isolate"] is True


def test_invalid_infection_origin_is_rejected(client, auth_headers):
    res = client.post(
        BASE_LAB,
        json={"organism_id": "ecoli", "infection_origin": "somewhere"},
        headers=auth_headers,
    )
    assert res.status_code == 422


def test_surveillance_metadata_is_stored(client, auth_headers):
    result = _post_isolate(
        client,
        auth_headers,
        infection_origin="hospital-onset",
        ast_standard="CLSI M100 Ed34",
    )
    assert result["infection_origin"] == "hospital-onset"
    assert result["ast_standard"] == "CLSI M100 Ed34"

    recent = client.get(
        "/api/v1/lab/recent-results?limit=50", headers=auth_headers
    ).json()
    saved = next(r for r in recent if r["id"] == result["id"])
    assert saved["infection_origin_label"] == "Hospital-onset"


# --- Quality indicators and reporting ---

def test_quality_endpoint_reports_duplicates_and_invasive_coverage(client, auth_headers):
    name = _name()
    _post_isolate(client, auth_headers, patient_name=name, specimen="Blood")
    _post_isolate(client, auth_headers, patient_name=name, specimen="Blood")

    body = client.get(
        f"{BASE_DASH}/surveillance-quality?hospital=Test%20Hospital"
    ).json()
    assert body["total_isolates"] >= 2
    assert body["duplicate_isolates"] >= 1
    assert body["invasive_isolates"] >= 1
    assert body["invasive_pct"] > 0
    assert body["dedup_window_days"] == 365
    assert "GLASS" in body["method"]


def test_monthly_report_includes_data_quality_section(client, auth_headers):
    res = client.get("/api/v1/reports/monthly?hospital=Test%20Hospital", headers=auth_headers)
    assert res.status_code == 200
    assert "SURVEILLANCE DATA QUALITY (WHO GLASS)" in res.text
    assert "Repeat isolates excluded (GLASS)" in res.text
    assert "ANTIBIOGRAM (S/I/R, first isolates)" in res.text


def test_quality_indicators_handle_empty_input():
    indicators = quality_indicators([])
    assert indicators["total_isolates"] == 0
    assert indicators["duplicate_pct"] == 0


# --- Schema upgrade ---

def test_surveillance_columns_exist_on_existing_database():
    columns = {column["name"] for column in inspect(engine).get_columns("labresult")}
    for column in (
        "patient_key",
        "is_first_isolate",
        "duplicate_of",
        "infection_origin",
        "ast_standard",
    ):
        assert column in columns
