"""Antibiogram aggregation shared by the dashboard and the monthly report.

Organisms and drugs are derived from the data instead of a hard-coded panel, so
new WHO priority pathogens appear automatically once isolates are recorded.
"""

from collections import Counter, defaultdict
from typing import Iterable, Sequence

from sqlmodel import Session, select

from app.models import LabResult, Organism

# Short display names keep wide tables readable; unknown ids fall back to the
# name stored in the organism reference table.
ORGANISM_DISPLAY = {
    "ecoli": "E. coli",
    "kpneumo": "K. pneumoniae",
    "saureus": "S. aureus",
    "pseudo": "P. aeruginosa",
    "efaecium": "E. faecium",
    "ecloacae": "E. cloacae",
    "abaumannii": "A. baumannii",
    "smaltophilia": "S. maltophilia",
    "styphi": "S. Typhi",
    "shigella": "Shigella spp.",
    "gonorrhoeae": "N. gonorrhoeae",
    "pneumoniae": "S. pneumoniae",
}

# Stable, clinically meaningful ordering for the common panel. Any additional
# drug found in the data is appended alphabetically.
PREFERRED_DRUGS = [
    "Ampicillin",
    "Amoxicillin",
    "Co-trimoxazole",
    "Nitrofurantoin",
    "Ceftriaxone",
    "Ceftazidime",
    "Cefepime",
    "Piperacillin-tazobactam",
    "Meropenem",
    "Vancomycin",
    "Linezolid",
    "Clindamycin",
    "Azithromycin",
    "Ciprofloxacin",
    "Levofloxacin",
    "Gentamicin",
    "Amikacin",
    "Doxycycline",
    "Tigecycline",
    "Colistin",
    "Fosfomycin",
]


# Different facilities write the same drug in different ways. Merge the common
# aliases so one agent is not split into two columns of the antibiogram.
DRUG_ALIASES = {
    "pip-tazo": "Piperacillin-tazobactam",
    "pip/tazo": "Piperacillin-tazobactam",
    "piperacillin/tazobactam": "Piperacillin-tazobactam",
    "tazobactam-piperacillin": "Piperacillin-tazobactam",
    "co-amoxiclav": "Amoxicillin-Clavulanate",
    "amox-clav": "Amoxicillin-Clavulanate",
    "augmentin": "Amoxicillin-Clavulanate",
    "tmp-smx": "Co-trimoxazole",
    "cotrimoxazole": "Co-trimoxazole",
    "bactrim": "Co-trimoxazole",
    "septra": "Co-trimoxazole",
}


def normalise_drug(name: str) -> str:
    cleaned = (name or "").strip()
    return DRUG_ALIASES.get(cleaned.lower(), cleaned)


def first_isolates(results: Iterable[LabResult]) -> list[LabResult]:
    """Apply the GLASS first-isolate rule before computing percentages."""
    return [r for r in results if getattr(r, "is_first_isolate", True)]


def organism_name(organism_id: str, names: dict[str, str]) -> str:
    return (
        ORGANISM_DISPLAY.get(organism_id)
        or names.get(organism_id)
        or organism_id
    )


def organism_names(session: Session) -> dict[str, str]:
    return {o.id: o.name for o in session.exec(select(Organism)).all()}


def aggregate(
    lab_results: Iterable[LabResult],
    names: dict[str, str],
) -> tuple[list[str], list[str], dict[str, dict[str, list[str]]]]:
    """Return (organisms, drugs, values-by-organism-and-drug)."""
    values: dict[str, dict[str, list[str]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for result in lab_results:
        organism = organism_name(result.organism_id, names)
        for drug, interpretation in (result.susceptibility or {}).items():
            if interpretation in {"S", "I", "R"}:
                values[organism][normalise_drug(drug)].append(interpretation)

    organisms = sorted(values)
    present = {drug for organism in organisms for drug in values[organism]}
    drugs = [drug for drug in PREFERRED_DRUGS if drug in present]
    drugs.extend(sorted(present - set(drugs)))
    return organisms, drugs, values


def modal_value(entries: Sequence[str]) -> str:
    return Counter(entries).most_common(1)[0][0] if entries else "-"
