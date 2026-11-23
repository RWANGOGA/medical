"""GLASS / EARS-Net stratification of the antibiogram."""

import uuid

from app.models import LabResult
from app.services.stratification import (
    age_group,
    origin_group,
    sex_group,
    stratify,
    unit_group,
)

BASE = "/api/v1/dashboard"


def _name():
    return f"Strat Patient {uuid.uuid4().hex[:10]}"


def _post_isolate(client, headers, **overrides):
    payload = {
        "patient_name": _name(),
        "organism_id": "ecoli",
        "specimen": "Urine",
        "hospital": "Strat Hospital",
        "susceptibility": {"Nitrofurantoin": "R"},
        "age": 72,
        "sex": "F",
        "unit": "ICU",
    }
    payload.update(overrides)
    res = client.post("/api/v1/lab/results", json=payload, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


def _cell(group, drug="Nitrofurantoin"):
    return next(c for c in group["cells"] if c["drug"] == drug)


# --- Grouping helpers ---

def test_age_bands_follow_ears_net():
    for age, key in ((10, "0-17"), (35, "18-49"), (60, "50-64"), (80, "65+"), (None, "unknown")):
        assert age_group(LabResult(age=age))[0] == key


def test_sex_and_unit_normalisation():
    assert sex_group(LabResult(sex="M"))[0] == "M"
    assert sex_group(LabResult(sex="female"))[0] == "F"
    assert sex_group(LabResult(sex=""))[0] == "unknown"
    assert unit_group(LabResult(unit="icu"))[0] == "icu"
    assert unit_group(LabResult(unit="Medical Ward"))[0] == "medical"
    assert origin_group(LabResult(infection_origin="hospital-onset"))[1] == "Hospital-onset"


# --- Capture and inheritance ---

def test_age_sex_unit_are_stored_on_isolate(client, auth_headers):
    result = _post_isolate(
        client, auth_headers, age=7, sex="M", unit="Paediatric ward"
    )
    assert result["age"] == 7
    assert result["sex"] == "M"
    assert result["unit"] == "Paediatric ward"


def test_demographics_inherited_from_linked_patient(client, auth_headers):
    patient = client.post(
        "/api/v1/patients/",
        json={
            "name": _name(),
            "hospital": "Strat Hospital",
            "age": 69,
            "sex": "F",
            "diagnosis": "Surveillance test",
        },
        headers=auth_headers,
    ).json()
    result = _post_isolate(
        client,
        auth_headers,
        patient_id=patient["id"],
        patient_name=patient["name"],
        age=None,
        sex="",
    )
    assert result["age"] == 69
    assert result["sex"] == "F"


def test_invalid_age_is_rejected(client, auth_headers):
    res = client.post(
        "/api/v1/lab/results",
        json={"organism_id": "ecoli", "age": 250},
        headers=auth_headers,
    )
    assert res.status_code == 422


# --- Stratified endpoint ---

def test_endpoint_returns_all_four_dimensions(client, auth_headers):
    _post_isolate(client, auth_headers)
    body = client.get(f"{BASE}/antibiogram-stratified").json()
    assert set(body["dimensions"]) == {"age_group", "sex", "unit", "infection_origin"}
    assert body["total_isolates"] > 0
    assert "GLASS" in body["method"]


def test_isolate_appears_in_its_age_and_unit_group(client, auth_headers):
    result = _post_isolate(
        client,
        auth_headers,
        age=72,
        sex="F",
        unit="ICU",
        susceptibility={"Nitrofurantoin": "R"},
    )
    body = client.get(
        f"{BASE}/antibiogram-stratified?hospital=Strat%20Hospital"
    ).json()

    age_group_row = next(
        g for g in body["dimensions"]["age_group"]["groups"] if g["key"] == "65+"
    )
    sex_group_row = next(
        g for g in body["dimensions"]["sex"]["groups"] if g["key"] == "F"
    )
    unit_group_row = next(
        g for g in body["dimensions"]["unit"]["groups"] if g["key"] == "icu"
    )
    assert age_group_row["isolates"] >= 1
    assert sex_group_row["isolates"] >= 1
    assert unit_group_row["isolates"] >= 1

    cell = _cell(age_group_row)
    assert cell["n"] >= 1
    assert cell["small_sample"] is True  # subgroup is far below n=30


def test_unknown_demographics_have_their_own_group(client, auth_headers):
    _post_isolate(client, auth_headers, age=None, sex="", unit="")
    body = client.get(
        f"{BASE}/antibiogram-stratified?hospital=Strat%20Hospital"
    ).json()
    unknown = next(
        g for g in body["dimensions"]["age_group"]["groups"] if g["key"] == "unknown"
    )
    assert unknown["isolates"] >= 1


def test_stratification_excludes_repeat_isolates_by_default(client, auth_headers):
    name = _name()
    first = _post_isolate(client, auth_headers, patient_name=name)
    second = _post_isolate(client, auth_headers, patient_name=name)
    assert second["is_first_isolate"] is False
    assert second["duplicate_of"] == first["id"]

    default = client.get(
        f"{BASE}/antibiogram-stratified?hospital=Strat%20Hospital"
    ).json()
    included = client.get(
        f"{BASE}/antibiogram-stratified?hospital=Strat%20Hospital&include_duplicates=true"
    ).json()
    assert included["total_isolates"] == default["total_isolates"] + 1


def test_pure_stratify_function_handles_empty_input():
    body = stratify([], {})
    assert body["total_isolates"] == 0
    assert all(
        dim["groups"] == [] for dim in body["dimensions"].values()
    )
