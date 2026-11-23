"""The antibiogram and report must cover every organism in the data, not a
hard-coded panel of four."""

ISOLATE = {
    "patient_name": "Global AMR Patient",
    "organism_id": "abaumannii",
    "specimen": "Sputum",
    "hospital": "Test Hospital",
    "susceptibility": {"Meropenem": "R", "Colistin": "S"},
}


def _record_isolate(client, auth_headers):
    res = client.post("/api/v1/lab/results", json=ISOLATE, headers=auth_headers)
    assert res.status_code == 200, res.text


def test_antibiogram_stats_include_new_priority_pathogen(client, auth_headers):
    _record_isolate(client, auth_headers)

    res = client.get("/api/v1/dashboard/antibiogram-stats")
    assert res.status_code == 200
    body = res.json()

    assert "A. baumannii" in body["organisms"]
    assert "Colistin" in body["drugs"]
    cell = body["cells"]["A. baumannii"]["Colistin"]
    assert cell["s"] >= 1
    assert cell["n"] >= 1


def test_antibiogram_grid_uses_the_same_dynamic_panel(client, auth_headers):
    _record_isolate(client, auth_headers)

    body = client.get("/api/v1/dashboard/antibiogram").json()
    organism_index = body["organisms"].index("A. baumannii")
    drug_index = body["drugs"].index("Colistin")
    assert body["grid"][organism_index][drug_index] == "S"


def test_monthly_report_includes_new_organisms(client, auth_headers):
    _record_isolate(client, auth_headers)

    res = client.get("/api/v1/reports/monthly", headers=auth_headers)
    assert res.status_code == 200
    assert "A. baumannii" in res.text
    assert "Colistin" in res.text
