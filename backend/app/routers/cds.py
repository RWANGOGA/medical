from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from app.db import get_session
from app.models import TreatmentProtocol, Antibiotic

router = APIRouter(prefix="/cds", tags=["Clinical Decision Support"])

class CDSRequest(BaseModel):
    organism_id: str
    allergy_penicillin: bool = False
    pregnant: bool = False
    renal_impairment: bool = False
    severe: bool = False

class CDSResponse(BaseModel):
    first_line: list[str]
    second_line: list[str]
    reserve: list[str]
    avoid: list[str]
    duration: str
    monitoring: list[str]
    reasoning: list[str]

@router.post("/recommend", response_model=CDSResponse)
def recommend(payload: CDSRequest, session: Session = Depends(get_session)):
    # 1. Fetch the protocol for this organism from the database
    protocol = session.exec(
        select(TreatmentProtocol).where(TreatmentProtocol.organism_id == payload.organism_id)
    ).first()
    
    if not protocol:
        raise HTTPException(status_code=404, detail="No treatment protocol found for this organism in the database.")

    # 2. Fetch all recommended drugs from the database
    all_drug_ids = protocol.first_line + protocol.second_line + protocol.reserve
    drugs = session.exec(select(Antibiotic).where(Antibiotic.id.in_(all_drug_ids))).all()
    drug_map = {d.id: d for d in drugs}

    first_line, second_line, reserve, avoid, reasoning = [], [], [], [], []

    # 3. Dynamic Filtering Logic based on DB Tags
    def process_drugs(drug_ids, target_list):
        for drug_id in drug_ids:
            drug = drug_map.get(drug_id)
            if not drug: continue
            
            # Check Penicillin Allergy against DB tags
            if payload.allergy_penicillin and ("beta-lactam" in drug.tags or "penicillin" in drug.tags):
                avoid.append(f"{drug.generic_name} (Avoid: Beta-lactam/Penicillin allergy)")
                reasoning.append(f"Excluded {drug.generic_name} due to beta-lactam/penicillin allergy cross-reactivity risk.")
                continue
                
            # Check Pregnancy against DB tags
            if payload.pregnant and "fluoroquinolone" in drug.tags:
                avoid.append(f"{drug.generic_name} (Avoid: Unsafe in pregnancy)")
                reasoning.append(f"Excluded {drug.generic_name} due to pregnancy (fluoroquinolone contraindicated).")
                continue
                
            target_list.append(drug.generic_name)

    process_drugs(protocol.first_line, first_line)
    process_drugs(protocol.second_line, second_line)
    process_drugs(protocol.reserve, reserve)

    if payload.renal_impairment:
        reasoning.append("Renal impairment noted: dose/interval adjustment required for renally cleared agents.")
    if payload.severe:
        reasoning.append("Severe/septic presentation: start broad empirical coverage immediately, then de-escalate.")

    return CDSResponse(
        first_line=first_line,
        second_line=second_line,
        reserve=reserve,
        avoid=avoid,
        duration=protocol.duration,
        monitoring=protocol.monitoring,
        reasoning=reasoning
    )