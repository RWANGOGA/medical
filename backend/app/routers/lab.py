from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Dict
from datetime import datetime, timezone

from app.db import get_session
from app.models import LabResult, User
from app.services.auth import get_current_user

router = APIRouter(prefix="/lab", tags=["Laboratory"])

class LabResultCreate(BaseModel):
    patient_name: str = ""
    organism_id: str
    specimen: str = ""
    hospital: str = ""
    collection_date: str = ""
    susceptibility: Dict[str, str] = {}

@router.post("/results")
def create_lab_result(
    payload: LabResultCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = LabResult(
        patient_name=payload.patient_name,
        organism_id=payload.organism_id,
        specimen=payload.specimen,
        hospital=payload.hospital or current_user.hospital,
        collection_date=payload.collection_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        susceptibility=payload.susceptibility,
        entered_by=current_user.username,
    )
    session.add(result)
    session.commit()
    session.refresh(result)
    return result

@router.get("/results")
def list_lab_results(session: Session = Depends(get_session)):
    return session.exec(select(LabResult).order_by(LabResult.id.desc())).all()