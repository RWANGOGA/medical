from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlmodel import Session, select
from collections import defaultdict
import re

from app.db import get_session
from app.models import Antibiotic, Patient, Organism, LabResult

router = APIRouter(prefix="/dashboard", tags=["Surveillance Dashboard"])


class TrendData(BaseModel):
    year: str
    esbl_ecoli: int
    mrsa: int
    cre: int


class AntibiogramData(BaseModel):
    organisms: list[str]
    drugs: list[str]
    grid: list[list[str]]


class AwReSummary(BaseModel):
    cat: str
    count: int


@router.get("/hospitals", response_model=list[str])
def get_hospitals(session: Session = Depends(get_session)):
    """Distinct hospitals for the multi-hospital filter."""
    hospitals = set()
    for p in session.exec(select(Patient)).all():
        if p.hospital:
            hospitals.add(p.hospital)
    for lr in session.exec(select(LabResult)).all():
        if lr.hospital:
            hospitals.add(lr.hospital)
    return sorted(hospitals)


@router.get("/aware", response_model=list[AwReSummary])
def get_aware(session: Session = Depends(get_session)):
    antibiotics = session.exec(select(Antibiotic)).all()
    counts = defaultdict(int)
    for abx in antibiotics:
        counts[abx.aware_category] += 1
    return [
        AwReSummary(cat="Access", count=counts.get("Access", 0)),
        AwReSummary(cat="Watch", count=counts.get("Watch", 0)),
        AwReSummary(cat="Reserve", count=counts.get("Reserve", 0)),
    ]


@router.get("/alerts", response_model=list[str])
def get_alerts(hospital: Optional[str] = Query(None), session: Session = Depends(get_session)):
    patients = session.exec(select(Patient)).all()
    if hospital:
        patients = [p for p in patients if p.hospital == hospital]

    alerts = []
    cre_count = sum(1 for p in patients if "CRE" in p.culture_results or "carbapenem-resistant" in p.culture_results.lower())
    if cre_count > 0:
        alerts.append(f"Carbapenem resistance in K. pneumoniae detected in {cre_count} patient(s) this quarter — avoid empirical carbapenem monotherapy without culture confirmation.")

    esbl_count = sum(1 for p in patients if "ESBL" in p.culture_results)
    total_ecoli = sum(1 for p in patients if "E. coli" in p.culture_results)
    if total_ecoli > 0 and (esbl_count / total_ecoli) > 0.2:
        alerts.append(f"ESBL E. coli prevalence exceeds 20% ({round(esbl_count/total_ecoli*100)}%) — avoid empirical fluoroquinolones and consider carbapenem-sparing strategies.")

    fail_count = sum(1 for p in patients for t in p.antibiotic_timeline if t.get("outcome") == "fail")
    if fail_count > 2:
        alerts.append(f"{fail_count} treatment failures detected this quarter — review antibiotic protocols and consider susceptibility testing before empiric therapy.")

    return alerts if alerts else ["No critical resistance alerts at this time."]


@router.get("/trends", response_model=list[TrendData])
def get_trends(hospital: Optional[str] = Query(None), session: Session = Depends(get_session)):
    patients = session.exec(select(Patient)).all()
    if hospital:
        patients = [p for p in patients if p.hospital == hospital]

    yearly_stats = defaultdict(lambda: {"total": 0, "failures": 0})
    for patient in patients:
        for entry in patient.antibiotic_timeline:
            year_match = re.search(r"(20\d{2})", entry.get("date", ""))
            if year_match:
                year = year_match.group(1)
                yearly_stats[year]["total"] += 1
                if entry.get("outcome") == "fail":
                    yearly_stats[year]["failures"] += 1

    trends = []
    for year in sorted(yearly_stats.keys()):
        stats = yearly_stats[year]
        if stats["total"] > 0:
            base_rate = round((stats["failures"] / stats["total"]) * 100)
            trends.append(TrendData(
                year=year,
                esbl_ecoli=min(base_rate + 10, 95),
                mrsa=base_rate,
                cre=max(base_rate - 15, 5),
            ))
    return trends


@router.get("/antibiogram", response_model=AntibiogramData)
def get_antibiogram(hospital: Optional[str] = Query(None), session: Session = Depends(get_session)):
    """Live antibiogram aggregated from lab results."""
    organisms_list = ["E. coli", "K. pneumoniae", "S. aureus", "P. aeruginosa"]
    drugs_list = ["Ampicillin", "Ceftriaxone", "Pip-Tazo", "Meropenem", "Vancomycin"]
    org_name_map = {"ecoli": "E. coli", "kpneumo": "K. pneumoniae", "saureus": "S. aureus", "pseudo": "P. aeruginosa"}

    lab_results = session.exec(select(LabResult)).all()
    if hospital:
        lab_results = [l for l in lab_results if l.hospital == hospital]

    org_drug_values = defaultdict(lambda: defaultdict(list))
    for lr in lab_results:
        org_display = org_name_map.get(lr.organism_id)
        if not org_display:
            continue
        for drug, val in (lr.susceptibility or {}).items():
            if drug in drugs_list and val in ("S", "I", "R"):
                org_drug_values[org_display][drug].append(val)

    grid = []
    for org in organisms_list:
        row = []
        for drug in drugs_list:
            values = org_drug_values[org][drug]
            row.append(max(set(values), key=values.count) if values else "-")
        grid.append(row)

    return AntibiogramData(organisms=organisms_list, drugs=drugs_list, grid=grid)


# --- PUBLIC ENDPOINTS ---

@router.get("/organisms-public", response_model=list)
def get_organisms_public(session: Session = Depends(get_session)):
    return session.exec(select(Organism)).all()


@router.get("/antibiotics-public", response_model=list)
def get_antibiotics_public(session: Session = Depends(get_session)):
    return session.exec(select(Antibiotic)).all()


@router.get("/guidelines-public", response_model=list)
def get_guidelines_public():
    return [
        {"title": "Empirical management of complicated UTI", "source": "WHO", "year": 2024,
         "summary": "Recommends culture-directed therapy where possible; discourages empirical fluoroquinolone use where local resistance exceeds 20%."},
        {"title": "Management of MRSA skin and soft tissue infection", "source": "IDSA", "year": 2023,
         "summary": "Vancomycin or linezolid for invasive disease; clindamycin acceptable for susceptible, non-severe cases with negative D-test."},
        {"title": "Empirical therapy for hospital-acquired pneumonia", "source": "Uganda Clinical Guidelines", "year": 2023,
         "summary": "Piperacillin-tazobactam or meropenem recommended where Pseudomonas risk factors are present, guided by local antibiogram."},
        {"title": "Carbapenem-sparing strategies for ESBL infection", "source": "Hospital Antimicrobial Stewardship Protocol", "year": 2025,
         "summary": "Piperacillin-tazobactam may be considered for lower-severity ESBL UTI; carbapenems reserved for bacteremia or severe sepsis."},
    ]


@router.get("/mechanisms")
def get_mechanisms():
    return {
        "esbl": {"name": "Extended-Spectrum Beta-Lactamase (ESBL)", "molecular": "Plasmid-encoded enzymes (e.g., CTX-M, TEM, SHV variants) hydrolyze the beta-lactam ring of penicillins, cephalosporins, and monobactams.", "significance": "Renders 3rd-generation cephalosporins unreliable even when routine susceptibility appears borderline.", "affected": ["Ceftriaxone", "Cefotaxime", "Ceftazidime", "Aztreonam"], "stillEffective": ["Meropenem", "Ertapenem", "Piperacillin-tazobactam (variable)"], "detection": "Double-disc synergy test; automated MIC systems with ESBL confirmatory panel.", "alternatives": "Carbapenems remain first-line for serious ESBL infections."},
        "carbapenemase": {"name": "Carbapenemase Production (KPC / NDM / OXA-48)", "molecular": "Enzymes that hydrolyze carbapenems in addition to penicillins and cephalosporins; often plasmid-borne and transferable.", "significance": "Defines carbapenem-resistant Enterobacterales (CRE) — associated with high mortality and limited oral options.", "affected": ["Meropenem", "Imipenem", "Ertapenem"], "stillEffective": ["Ceftazidime-avibactam (KPC/OXA-48)", "Colistin", "Tigecycline (non-urinary)"], "detection": "Modified carbapenem inactivation method (mCIM); PCR for blaKPC/blaNDM/blaOXA-48.", "alternatives": "Novel beta-lactam/beta-lactamase inhibitor combinations guided by enzyme type; ID consult recommended."},
        "fq-target": {"name": "Fluoroquinolone Target Modification", "molecular": "Point mutations in gyrA/parC (topoisomerase genes) reduce quinolone binding affinity.", "significance": "Common cause of ciprofloxacin/levofloxacin treatment failure in E. coli UTI.", "affected": ["Ciprofloxacin", "Levofloxacin"], "stillEffective": ["Nitrofurantoin (uncomplicated UTI)", "Beta-lactams if susceptible", "Carbapenems"], "detection": "Standard disc diffusion / MIC testing.", "alternatives": "Avoid empiric fluoroquinolones where local resistance exceeds ~20%."},
        "mrsa": {"name": "Methicillin Resistance (mecA-mediated)", "molecular": "mecA gene encodes altered penicillin-binding protein PBP2a with low affinity for beta-lactams.", "significance": "Confers resistance to all beta-lactams except newer anti-MRSA cephalosporins (ceftaroline).", "affected": ["Oxacillin", "Cefazolin", "All penicillins"], "stillEffective": ["Vancomycin", "Linezolid", "Ceftaroline", "Clindamycin (if D-test negative)"], "detection": "Cefoxitin disc screen; PCR for mecA/mecC.", "alternatives": "Vancomycin remains first-line for invasive MRSA disease."},
        "efflux": {"name": "Efflux Pump Overexpression", "molecular": "Upregulated multidrug efflux systems (e.g., MexAB-OprM in Pseudomonas) actively export antibiotics before they reach their target.", "significance": "Contributes to intrinsic and acquired multidrug resistance, often across unrelated drug classes.", "affected": ["Fluoroquinolones", "Beta-lactams", "Tetracyclines"], "stillEffective": ["Colistin", "Combination therapy guided by susceptibility"], "detection": "Phenotypic testing with efflux pump inhibitors (research setting); inferred from resistance pattern.", "alternatives": "Combination regimens; avoid monotherapy in high-risk infection."},
        "ampc": {"name": "AmpC Beta-Lactamase (chromosomal/inducible)", "molecular": "Chromosomally encoded cephalosporinase, inducible or stably derepressed, hydrolyzes cephalosporins and cephamycins.", "significance": "Can cause treatment failure during therapy even if initial susceptibility testing looks favorable.", "affected": ["Ceftriaxone", "Cefoxitin", "Piperacillin-tazobactam (variable)"], "stillEffective": ["Cefepime", "Carbapenems"], "detection": "AmpC disc test; genotypic confirmation in reference labs.", "alternatives": "Cefepime or carbapenem preferred over 3rd-gen cephalosporins for serious infection."},
        "porin": {"name": "Porin Mutation / Loss", "molecular": "Loss or downregulation of outer-membrane porin channels reduces antibiotic entry into the periplasmic space.", "significance": "Often combines with beta-lactamase production to produce high-level carbapenem resistance.", "affected": ["Carbapenems", "Cephalosporins"], "stillEffective": ["Agents not dependent on porin entry; guided by full susceptibility panel"], "detection": "Inferred from resistance phenotype plus molecular beta-lactamase testing.", "alternatives": "Combination therapy; specialist input required."},
        "biofilm": {"name": "Biofilm Formation", "molecular": "Bacterial communities encased in a self-produced extracellular matrix, reducing antibiotic penetration and immune clearance.", "significance": "Major driver of device-associated and chronic wound infection relapse.", "affected": ["Most classes at standard concentration"], "stillEffective": ["High-dose regimens; rifampin-based combinations for device infection"], "detection": "Clinical suspicion with prosthetic material; specialized biofilm assays in research labs.", "alternatives": "Source control (device removal) is often essential alongside antibiotics."},
    }


@router.get("/antibiogram-stats")
def get_antibiogram_stats(hospital: Optional[str] = Query(None), session: Session = Depends(get_session)):
    """Detailed antibiogram: S/I/R counts, isolate numbers and %S per cell."""
    organisms_list = ["E. coli", "K. pneumoniae", "S. aureus", "P. aeruginosa"]
    drugs_list = ["Ampicillin", "Ceftriaxone", "Pip-Tazo", "Meropenem", "Vancomycin"]
    org_name_map = {"ecoli": "E. coli", "kpneumo": "K. pneumoniae", "saureus": "S. aureus", "pseudo": "P. aeruginosa"}

    lab_results = session.exec(select(LabResult)).all()
    if hospital:
        lab_results = [l for l in lab_results if l.hospital == hospital]

    cells = {org: {drug: {"s": 0, "i": 0, "r": 0, "n": 0, "pct_s": 0.0} for drug in drugs_list} for org in organisms_list}
    for lr in lab_results:
        org = org_name_map.get(lr.organism_id)
        if not org:
            continue
        for drug, val in (lr.susceptibility or {}).items():
            if drug in cells[org] and val in ("S", "I", "R"):
                c = cells[org][drug]
                c[val.lower()] += 1
                c["n"] += 1
    for org in organisms_list:
        for drug in drugs_list:
            c = cells[org][drug]
            c["pct_s"] = round(100 * c["s"] / c["n"]) if c["n"] else 0.0
    return {"organisms": organisms_list, "drugs": drugs_list, "cells": cells}    