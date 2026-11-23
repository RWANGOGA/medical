"""WHO GLASS-AMC antimicrobial consumption reporting."""

BASE = "/api/v1/amc"


def _use(client, headers, antibiotic_id="amoxi", **overrides):
    payload = {
        "antibiotic_id": antibiotic_id,
        "hospital": "Test Hospital",
        "start_date": "2026-05-02",
        "duration_days": 10,
        "daily_dose_mg": 1000.0,
    }
    payload.update(overrides)
    res = client.post(f"{BASE}/use", json=payload, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


def test_reference_ddd_values_are_loaded(client, auth_headers):
    drugs = {d["id"]: d for d in client.get("/api/v1/antibiotics/").json()}
    assert drugs["ceftri"]["atc_code"] == "J01DD04"
    assert drugs["ceftri"]["ddd_value_mg"] == 2000.0
    assert drugs["pipetazo"]["ddd_value_mg"] == 14000.0


def test_record_use_requires_auth(client):
    res = client.post(f"{BASE}/use", json={"antibiotic_id": "amoxi"})
    assert res.status_code == 401


def test_record_use_rejects_unknown_antibiotic(client, auth_headers):
    res = client.post(
        f"{BASE}/use",
        json={"antibiotic_id": "not-a-drug", "duration_days": 5},
        headers=auth_headers,
    )
    assert res.status_code == 404


def test_record_use_rejects_another_hospital(client, auth_headers):
    res = client.post(
        f"{BASE}/use",
        json={
            "antibiotic_id": "amoxi",
            "hospital": "Some Other Hospital",
            "duration_days": 5,
        },
        headers=auth_headers,
    )
    assert res.status_code == 403


def test_dose_based_ddd_is_exact(client, auth_headers):
    # Ceftriaxone DDD is 2 g; 2 g/day for 4 days = 4 DDDs.
    exact = _use(
        client,
        auth_headers,
        antibiotic_id="ceftri",
        daily_dose_mg=2000.0,
        duration_days=4,
    )
    assert exact["estimated_ddd"] is False
    assert exact["duration_days"] == 4

    body = client.get(f"{BASE}/summary?hospital=Test%20Hospital").json()
    ceftri = next(d for d in body["by_drug"] if d["antibiotic_id"] == "ceftri")
    assert ceftri["ddd"] >= 4


def test_missing_dose_is_flagged_as_estimated(client, auth_headers):
    use = _use(client, auth_headers, daily_dose_mg=None)
    assert use["estimated_ddd"] is True
    body = client.get(f"{BASE}/summary?hospital=Test%20Hospital").json()
    assert body["estimated_episodes"] >= 1
    assert body["estimated_pct"] > 0


def test_duration_can_be_derived_from_dates(client, auth_headers):
    use = _use(
        client,
        auth_headers,
        duration_days=0,
        start_date="2026-05-02",
        end_date="2026-05-06",
    )
    assert use["duration_days"] == 5


def test_activity_upsert_and_ddd_per_100_patient_days(client, auth_headers):
    activity = {
        "hospital": "Test Hospital",
        "period": "2026-05",
        "patient_days": 100,
        "admissions": 12,
    }
    first = client.post(f"{BASE}/activity", json=activity, headers=auth_headers)
    assert first.status_code == 200, first.text
    activity_id = first.json()["id"]

    changed = dict(activity, patient_days=200)
    second = client.post(f"{BASE}/activity", json=changed, headers=auth_headers)
    assert second.status_code == 200
    assert second.json()["id"] == activity_id
    assert second.json()["patient_days"] == 200

    summary = client.get(f"{BASE}/summary?hospital=Test%20Hospital").json()
    may = next(row for row in summary["by_month"] if row["month"] == "2026-05")
    assert may["patient_days"] == 200
    assert may["ddd_per_100_patient_days"] is not None
    assert summary["denominator_months"] >= 1


def test_summary_reports_aware_split_and_access_target(client, auth_headers):
    body = client.get(f"{BASE}/summary").json()
    categories = {row["cat"]: row for row in body["aware"]}
    assert {"Access", "Watch", "Reserve"} <= set(categories)
    assert categories["Access"]["target"] == 60
    assert sum(row["pct"] for row in body["aware"]) in range(98, 103)
    assert body["total_ddd"] > 0
    assert "GLASS-AMC" in body["method"]


def test_summary_hospital_filter_only_returns_that_facility(client, auth_headers):
    all_ = client.get(f"{BASE}/summary").json()
    one = client.get(f"{BASE}/summary?hospital=Jinja%20Regional%20Hospital").json()
    assert one["episodes"] < all_["episodes"]
    assert one["by_unit"]
    assert all(row["unit"] for row in one["by_unit"])


def test_month_range_filter(client, auth_headers):
    body = client.get(
        f"{BASE}/summary?from_month=2026-03&to_month=2026-03"
    ).json()
    assert {row["month"] for row in body["by_month"]} == {"2026-03"}


def test_consumption_records_are_scoped(client, auth_headers):
    records = client.get(f"{BASE}/use?limit=200", headers=auth_headers).json()
    assert records
    assert all(r["hospital"] == "Test Hospital" for r in records)
