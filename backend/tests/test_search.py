"""POST /search/patients — the "check the database first" lookup that
powers the mobile add-patient dedup flow."""

BASE = "/api/v1/search/patients"

PATIENT = {
    "name": "Namugalu Grace",
    "national_id": "UG-SRCH-777",
    "hospital": "Search Test Hospital",
    "age": 29,
    "sex": "F",
    "diagnosis": "Malaria with secondary bacterial infection",
}


def _seed_patient(client, auth_headers):
    res = client.post("/api/v1/patients/", json=PATIENT, headers=auth_headers)
    assert res.status_code == 200, res.text
    return res.json()


def test_search_requires_auth(client):
    assert client.post(BASE, json={"query": "x"}).status_code == 401


def test_search_by_name(client, auth_headers):
    _seed_patient(client, auth_headers)
    res = client.post(BASE, json={"query": "Namugalu"}, headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    names = [p["name"] for p in body["patients"]]
    assert "Namugalu Grace" in names


def test_search_exact_name_match_raises_duplicate_warning(client, auth_headers):
    _seed_patient(client, auth_headers)
    res = client.post(BASE, json={"query": "Namugalu Grace"}, headers=auth_headers)
    body = res.json()
    # exact name match must surface a duplicate warning
    assert body["duplicate_warning"] is not None
    assert "verify" in body["duplicate_warning"].lower()


def test_search_by_national_id(client, auth_headers):
    _seed_patient(client, auth_headers)
    res = client.post(BASE, json={"query": "UG-SRCH-777"}, headers=auth_headers)
    body = res.json()
    ids = [p["national_id"] for p in body["patients"]]
    assert "UG-SRCH-777" in ids


def test_search_is_case_insensitive(client, auth_headers):
    _seed_patient(client, auth_headers)
    res = client.post(BASE, json={"query": "namugalu"}, headers=auth_headers)
    assert any(p["name"] == "Namugalu Grace" for p in res.json()["patients"])


def test_search_no_match_returns_empty_without_warning(client, auth_headers):
    res = client.post(BASE, json={"query": "zzz-no-such-patient-zzz"}, headers=auth_headers)
    body = res.json()
    assert body["patients"] == []
    assert body["duplicate_warning"] is None


def test_search_empty_query_returns_empty(client, auth_headers):
    res = client.post(BASE, json={"query": "   "}, headers=auth_headers)
    assert res.json()["patients"] == []
