"""Clinical decision support: culture-directed and safety-aware behaviour."""

BASE = "/api/v1/cds/recommend"


def _recommend(client, auth_headers, **payload):
    res = client.post(BASE, json=payload, headers=auth_headers)
    assert res.status_code == 200, res.text
    return res.json()


def _joined(body, field):
    return " | ".join(body[field])


def test_every_seeded_organism_has_a_protocol(client, auth_headers):
    for organism_id in (
        "ecoli",
        "kpneumo",
        "saureus",
        "pseudo",
        "efaecium",
        "ecloacae",
        "abaumannii",
        "smaltophilia",
        "styphi",
        "shigella",
        "gonorrhoeae",
        "pneumoniae",
    ):
        body = _recommend(client, auth_headers, organism_id=organism_id)
        assert body["first_line"] or body["second_line"] or body["reserve"]


def test_unknown_organism_returns_404(client, auth_headers):
    res = client.post(BASE, json={"organism_id": "not-a-real-bug"}, headers=auth_headers)
    assert res.status_code == 404


def test_culture_directed_uti_uses_susceptible_agent(client, auth_headers):
    body = _recommend(
        client,
        auth_headers,
        organism_id="ecoli",
        infection_site="urinary",
        culture_susceptibility={
            "Nitrofurantoin": "S",
            "Ceftriaxone": "R",
            "Meropenem": "S",
        },
    )
    assert body["culture_directed"] is True
    assert any(x.startswith("Nitrofurantoin") for x in body["first_line"])
    assert any("Ceftriaxone" in x for x in body["avoid"])
    assert any("resistant" in x.lower() for x in body["reasoning"])


def test_bacteremia_excludes_urine_only_agent(client, auth_headers):
    body = _recommend(
        client,
        auth_headers,
        organism_id="ecoli",
        infection_site="blood",
        culture_susceptibility={
            "Nitrofurantoin": "S",
            "Ceftriaxone": "R",
            "Piperacillin-tazobactam": "S",
        },
    )
    assert not any("Nitrofurantoin" in x for x in body["first_line"])
    assert any("Nitrofurantoin" in x for x in body["avoid"])
    # The only susceptible non-urinary option is promoted.
    assert any(x.startswith("Piperacillin-tazobactam") for x in body["first_line"])


def test_esbl_excludes_cephalosporins_even_when_reported_susceptible(client, auth_headers):
    body = _recommend(
        client,
        auth_headers,
        organism_id="kpneumo",
        esbl=True,
        culture_susceptibility={
            "Ceftriaxone": "S",
            "Piperacillin-tazobactam": "S",
        },
    )
    assert not any("Ceftriaxone" in x for x in body["first_line"])
    assert any("Ceftriaxone" in x for x in body["avoid"])
    assert any(x.startswith("Piperacillin-tazobactam") for x in body["first_line"])


def test_mrsa_avoids_beta_lactams_and_uses_anti_mrsa_agent(client, auth_headers):
    body = _recommend(
        client,
        auth_headers,
        organism_id="saureus",
        mrsa=True,
        infection_site="skin",
        culture_susceptibility={"Cloxacillin": "R", "Vancomycin": "S"},
    )
    assert not any("Cloxacillin" in x for x in body["first_line"])
    assert any("Cloxacillin" in x for x in body["avoid"])
    assert any("Vancomycin" in x for x in body["first_line"])
    assert any("Reserve" in x for x in body["warnings"])


def test_pregnancy_excludes_fluoroquinolones_and_aminoglycosides(client, auth_headers):
    body = _recommend(client, auth_headers, organism_id="pseudo", pregnant=True)
    combined = " | ".join(
        body["first_line"] + body["second_line"] + body["reserve"]
    )
    assert "Ciprofloxacin" not in combined
    assert "Gentamicin" not in combined
    assert any("pregnancy" in x.lower() for x in body["avoid"])


def test_penicillin_allergy_excludes_beta_lactams(client, auth_headers):
    body = _recommend(
        client, auth_headers, organism_id="saureus", allergy_penicillin=True
    )
    combined = " | ".join(
        body["first_line"] + body["second_line"] + body["reserve"]
    )
    for beta_lactam in ("Cloxacillin", "Cefazolin", "Amoxicillin-Clavulanate"):
        assert beta_lactam not in combined
        assert any(beta_lactam in x for x in body["avoid"])


def test_intermediate_result_produces_a_warning(client, auth_headers):
    body = _recommend(
        client,
        auth_headers,
        organism_id="ecoli",
        infection_site="urinary",
        culture_susceptibility={"Ceftriaxone": "I"},
    )
    assert any("intermediate" in x.lower() for x in body["warnings"])


def test_missing_site_warns_about_urine_only_agents(client, auth_headers):
    body = _recommend(client, auth_headers, organism_id="ecoli")
    assert any("Infection site" in x for x in body["warnings"])


def test_tigecycline_excluded_from_urinary_infection(client, auth_headers):
    body = _recommend(
        client,
        auth_headers,
        organism_id="smaltophilia",
        infection_site="urinary",
        culture_susceptibility={"Tigecycline": "S"},
    )
    assert any("Tigecycline" in x for x in body["avoid"])


def test_tigecycline_excluded_from_bloodstream_infection(client, auth_headers):
    body = _recommend(
        client,
        auth_headers,
        organism_id="abaumannii",
        infection_site="blood",
        culture_susceptibility={"Tigecycline": "S"},
    )
    assert any("Tigecycline" in x for x in body["avoid"])


def test_new_priority_pathogen_is_culture_directed(client, auth_headers):
    body = _recommend(
        client,
        auth_headers,
        organism_id="abaumannii",
        infection_site="respiratory",
        culture_susceptibility={"Meropenem": "R", "Colistin": "S"},
    )
    assert body["culture_directed"] is True
    assert any("Meropenem" in x for x in body["avoid"])
    # Colistin is the only susceptible option, so it is promoted to the front.
    assert any("Colistin" in x for x in body["first_line"])
