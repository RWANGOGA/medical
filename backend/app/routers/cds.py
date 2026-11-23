from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.db import get_session
from app.models import Antibiotic, TreatmentProtocol, User
from app.services.auth import get_current_user

router = APIRouter(prefix="/cds", tags=["Clinical Decision Support"])

# WHO AWaRe ordering: prefer the narrowest agent that will work.
AWARE_RANK = {"Access": 0, "Watch": 1, "Reserve": 2}

# Drugs that a species resists regardless of the laboratory panel. Applying
# these avoids recommending an agent that will fail even before cultures return.
INTRINSIC_RESISTANCE = {
    "kpneumo": {"amoxi", "coamox"},
    "pseudo": {"amoxi", "coamox", "ceftri", "cotrim", "nitro", "azithro"},
    "saureus": {"nitro", "colistin"},
    "ecoli": set(),
    "efaecium": {"ceftri", "cefaz", "cefepime", "ceftaz", "clinda", "cotrim"},
    "ecloacae": {"ceftri", "cefaz", "coamox"},
    "abaumannii": {"amoxi", "coamox", "ceftri", "nitro", "fosfo"},
    "smaltophilia": {"merope", "amikacin", "genta", "ceftri", "amoxi", "coamox"},
    "styphi": set(),
    "shigella": set(),
    "gonorrhoeae": {"cotrim", "nitro"},
    "pneumoniae": {"nitro", "colistin", "genta"},
}

# Agents whose clinical usefulness depends on the infection site.
URINE_ONLY = {
    "nitro": "Nitrofurantoin achieves therapeutic levels only in urine; it is not "
    "appropriate for pyelonephritis, bacteremia or other tissue infection.",
    "fosfo": "Fosfomycin is used as a single oral dose for uncomplicated "
    "cystitis and does not treat tissue infection.",
}

POOR_URINE = {
    "tige": "Tigecycline does not achieve reliable urinary concentrations.",
}

POOR_BLOOD = {
    "tige": "Tigecycline is not recommended for bloodstream infection because "
    "serum concentrations are low.",
}

URINARY_SITES = {"urinary", "urine", "uti", "cystitis", "bladder"}
PYELONEPHRITIS_SITES = {"pyelonephritis", "upper urinary", "kidney"}

SITE_SYNONYMS = {
    "urinary tract": "urinary",
    "urine": "urinary",
    "uti": "urinary",
    "cystitis": "urinary",
    "bladder": "urinary",
    "bloodstream": "blood",
    "bacteremia": "blood",
    "bacteraemia": "blood",
    "lung": "respiratory",
    "pneumonia": "respiratory",
    "lower respiratory tract": "respiratory",
    "wound": "skin",
    "soft tissue": "skin",
    "skin and soft tissue": "skin",
    "ssti": "skin",
    "abdomen": "intra-abdominal",
    "abdominal": "intra-abdominal",
    "peritonitis": "intra-abdominal",
    "meningitis": "cns",
    "brain": "cns",
    "cerebrospinal fluid": "cns",
}


class CDSRequest(BaseModel):
    organism_id: str
    allergy_penicillin: bool = False
    pregnant: bool = False
    renal_impairment: bool = False
    severe: bool = False
    infection_site: str = ""
    # Drug name (generic name or id) -> "S", "I" or "R".
    culture_susceptibility: dict[str, str] = Field(default_factory=dict)
    # Explicit resistance flags for organisms where the lab reports a
    # phenotype rather than a full panel.
    esbl: bool = False
    carbapenemase: bool = False
    mrsa: bool = False


class CDSResponse(BaseModel):
    first_line: list[str]
    second_line: list[str]
    reserve: list[str]
    avoid: list[str]
    duration: str
    monitoring: list[str]
    reasoning: list[str]
    culture_directed: bool = False
    warnings: list[str] = Field(default_factory=list)


def _normalise_site(site: str) -> str:
    normalised = site.strip().lower()
    return SITE_SYNONYMS.get(normalised, normalised)


def _susceptibility_lookup(
    raw: dict[str, str], drugs: list[Antibiotic]
) -> dict[str, str]:
    """Map S/I/R results onto drug ids.

    Clinicians type generic names, while the protocol stores ids, so accept
    both and ignore unknown or malformed entries.
    """
    by_name: dict[str, str] = {}
    for drug in drugs:
        by_name[drug.id.lower()] = drug.id
        by_name[drug.generic_name.lower()] = drug.id

    lookup: dict[str, str] = {}
    for key, value in raw.items():
        drug_id = by_name.get(key.strip().lower())
        result = value.strip().upper()[:1]
        if drug_id and result in {"S", "I", "R"}:
            lookup[drug_id] = result
    return lookup


def _site_allows(drug_id: str, site: str, severe: bool) -> tuple[bool, str]:
    if site in URINARY_SITES and drug_id in POOR_URINE:
        return False, POOR_URINE[drug_id]
    if site in {"blood", "bacteremia", "bacteraemia"} and drug_id in POOR_BLOOD:
        return False, POOR_BLOOD[drug_id]

    if drug_id not in URINE_ONLY:
        return True, ""
    # Site not supplied: keep the drug but flag it (handled by the caller).
    if not site:
        return True, ""
    if site in PYELONEPHRITIS_SITES:
        return False, (
            "does not achieve tissue levels and cannot treat pyelonephritis"
        )
    if site not in URINARY_SITES:
        return False, "is active only in urine and cannot treat this site"
    if severe:
        return False, (
            "is not appropriate for severe or systemic infection; use a "
            "parenteral agent with tissue penetration"
        )
    return True, ""


@router.post("/recommend", response_model=CDSResponse)
def recommend(
    payload: CDSRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    protocol = session.exec(
        select(TreatmentProtocol).where(
            TreatmentProtocol.organism_id == payload.organism_id
        )
    ).first()

    if not protocol:
        raise HTTPException(
            status_code=404,
            detail="No treatment protocol found for this organism in the database.",
        )

    protocol_ids = protocol.first_line + protocol.second_line + protocol.reserve
    drugs = session.exec(
        select(Antibiotic).where(Antibiotic.id.in_(protocol_ids))
    ).all()
    drug_map = {d.id: d for d in drugs}
    susceptibility = _susceptibility_lookup(payload.culture_susceptibility, drugs)

    avoid: list[str] = []
    reasoning: list[str] = []
    warnings: list[str] = []

    site = _normalise_site(payload.infection_site)
    intrinsic = INTRINSIC_RESISTANCE.get(payload.organism_id, set())
    culture_directed = bool(susceptibility) or payload.esbl or payload.carbapenemase or payload.mrsa

    # Phenotype shortcuts: these override a "susceptible" beta-lactam result.
    if payload.esbl:
        reasoning.append(
            "ESBL phenotype: third-generation cephalosporins are unreliable even "
            "when the laboratory reports them as susceptible."
        )
    if payload.carbapenemase:
        reasoning.append(
            "Carbapenemase phenotype: carbapenems are unreliable; use a "
            "carbapenemase-active combination or a reserve agent guided by the "
            "enzyme type."
        )
    if payload.mrsa:
        reasoning.append(
            "MRSA phenotype: all standard beta-lactams are inactive; use an "
            "anti-MRSA agent."
        )

    def classify(drug: Antibiotic) -> tuple[bool, str]:
        """Return (keep, reason-if-dropped)."""
        if drug.id in intrinsic:
            return False, "is intrinsically inactive against this organism"

        if payload.mrsa and "beta-lactam" in drug.tags:
            return False, "is inactive against MRSA (mecA/PBP2a)"
        if payload.carbapenemase and "carbapenem" in drug.tags:
            return False, "is unreliable with carbapenemase production"
        if payload.esbl and (
            "cephalosporin" in drug.tags and "carbapenem" not in drug.tags
        ):
            return False, "is unreliable against ESBL producers"

        if payload.allergy_penicillin and (
            "beta-lactam" in drug.tags or "penicillin" in drug.tags
        ):
            return False, "excluded because of beta-lactam/penicillin allergy"

        if payload.pregnant:
            if "fluoroquinolone" in drug.tags or "aminoglycoside" in drug.tags:
                return False, "excluded in pregnancy (fetal safety)"
            if drug.id == "cotrim":
                return False, "avoided in pregnancy (folate antagonism)"
            if drug.id == "nitro":
                return False, "avoided near term or with G6PD deficiency"

        allowed, reason = _site_allows(drug.id, site, payload.severe)
        if not allowed:
            return False, reason

        result = susceptibility.get(drug.id)
        if result == "R":
            return False, "is resistant on the reported culture"
        return True, ""

    def susceptibility_rank(drug: Antibiotic) -> int:
        return {"S": 0, "I": 2}.get(susceptibility.get(drug.id), 1)

    def collect(ids: list[str]) -> list[Antibiotic]:
        kept = []
        for drug_id in ids:
            drug = drug_map.get(drug_id)
            if not drug:
                continue
            keep, reason = classify(drug)
            if not keep:
                if reason:
                    avoid.append(f"{drug.generic_name} (Avoid: {reason})")
                    if "reported culture" in reason:
                        reasoning.append(
                            f"{drug.generic_name} excluded: {reason}."
                        )
                continue
            kept.append(drug)

        # Susceptible agents first, then Access before Watch before Reserve.
        kept.sort(
            key=lambda d: (
                susceptibility_rank(d),
                AWARE_RANK.get(d.aware_category, 3),
            )
        )
        return kept

    first_drugs = collect(protocol.first_line)
    second_drugs = collect(protocol.second_line)
    reserve_drugs = collect(protocol.reserve)

    # Culture-directed promotion: if nothing in the preferred tier survived,
    # promote the best option, preferring a susceptible result over an untested
    # agent and a second-line agent over a reserve agent.
    if culture_directed and not first_drugs and (second_drugs or reserve_drugs):
        candidates = list(second_drugs) + list(reserve_drugs)
        second_ids = {d.id for d in second_drugs}
        candidates.sort(
            key=lambda d: (
                susceptibility_rank(d),
                0 if d.id in second_ids else 1,
                AWARE_RANK.get(d.aware_category, 3),
            )
        )
        promoted = candidates[0]
        if promoted.id in second_ids:
            second_drugs.remove(promoted)
            origin = "second-line"
        else:
            reserve_drugs.remove(promoted)
            origin = "reserve"
        first_drugs.append(promoted)
        warnings.append(
            f"No susceptible first-line agent remained; {promoted.generic_name} "
            f"(originally {origin}) is promoted."
        )

    def label_tier(tier: list[Antibiotic]) -> list[str]:
        labels = []
        for drug in tier:
            result = susceptibility.get(drug.id)
            label = drug.generic_name
            if result == "S":
                label += " (susceptible)"
                reasoning.append(
                    f"{drug.generic_name} is susceptible on the reported culture."
                )
            elif result == "I":
                label += " (intermediate — optimise dose)"
                warnings.append(
                    f"{drug.generic_name} is intermediate: use an optimised dose, "
                    "prolonged infusion where relevant, and review at 48-72 hours."
                )
            labels.append(label)
        return labels

    first_line = label_tier(first_drugs)
    second_line = label_tier(second_drugs)
    reserve = label_tier(reserve_drugs)

    if culture_directed and not first_line and not second_line and not reserve:
        warnings.append(
            "No susceptible agent in the protocol matches this isolate. Obtain a "
            "full susceptibility panel and seek infectious-diseases advice; "
            "consider combination therapy or a reserved agent."
        )

    # Stewardship signal: reserve agents should never be the silent default.
    if reserve:
        warnings.append(
            "Reserve agents are last-line options: confirm the indication, obtain "
            "expert input, and document the reason for use."
        )

    if not site:
        urine_names = [
            drug_map[drug_id].generic_name
            for drug_id in URINE_ONLY
            if drug_id in drug_map
        ]
        recommended = first_line + second_line + reserve
        if any(
            rec.startswith(name) for rec in recommended for name in urine_names
        ):
            warnings.append(
                "Infection site was not provided. Confirm the site before using a "
                "urine-only agent such as nitrofurantoin."
            )

    if payload.renal_impairment:
        adjustments = [
            f"{drug.generic_name}: {drug.renal_adjustment.strip()}"
            for drug in drugs
            if (drug.renal_adjustment or "").strip()
        ]
        if adjustments:
            reasoning.append("Renal impairment — apply these dose adjustments:")
            reasoning.extend(f"- {item}" for item in adjustments)
        else:
            reasoning.append(
                "Renal impairment noted: verify dose and interval for renally "
                "cleared agents."
            )

    if payload.severe:
        reasoning.append(
            "Severe/septic presentation: start broad empirical coverage "
            "immediately, obtain cultures, and de-escalate once results return."
        )

    duration = protocol.duration
    if site in URINARY_SITES and "uncomplicated" in protocol.duration.lower():
        reasoning.append(
            "Urinary source: prefer the shortest effective course (5-7 days for "
            "uncomplicated cystitis; longer for pyelonephritis)."
        )

    return CDSResponse(
        first_line=first_line,
        second_line=second_line,
        reserve=reserve,
        avoid=avoid,
        duration=duration,
        monitoring=protocol.monitoring,
        reasoning=reasoning,
        culture_directed=culture_directed,
        warnings=warnings,
    )
