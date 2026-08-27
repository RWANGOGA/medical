from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Dict, Optional
from datetime import datetime, timezone

from app.db import get_session
from app.models import LabResult, Patient, User
from app.services.auth import get_current_user

router = APIRouter(prefix="/lab", tags=["Laboratory"])

class LabResultCreate(BaseModel):
    patient_name: str = ""
    organism_id: str
    specimen: str = ""
    hospital: str = ""
    collection_date: str = ""
    susceptibility: Dict[str, str] = {}
    patient_id: Optional[int] = None


@router.post("/results")
def create_lab_result(
    payload: LabResultCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Determine hospital
    hospital = payload.hospital or current_user.hospital or ""

    # Link to existing patient or create a new one if name provided
    linked_patient_id = payload.patient_id
    if not linked_patient_id and payload.patient_name:
        # Try to find existing patient by name (case-insensitive)
        existing = session.exec(
            select(Patient).where(Patient.name.ilike(payload.patient_name.strip()))
        ).first()
        if existing:
            linked_patient_id = existing.id
        else:
            # Create a minimal patient record so it appears in recent patients
            new_patient = Patient(
                name=payload.patient_name.strip(),
                hospital=hospital,
                age=0,
                sex="Unknown",
                diagnosis="Pending diagnosis",
                entered_by=current_user.username,
            )
            session.add(new_patient)
            session.flush()  # Get the ID without committing
            linked_patient_id = new_patient.id

    result = LabResult(
        patient_name=payload.patient_name,
        organism_id=payload.organism_id,
        specimen=payload.specimen,
        hospital=hospital,
        collection_date=payload.collection_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        susceptibility=payload.susceptibility,
        entered_by=current_user.username,
        patient_id=linked_patient_id,
    )
    session.add(result)
    session.commit()
    session.refresh(result)
    return result


@router.get("/results")
def list_lab_results(
    limit: int = 50,
    session: Session = Depends(get_session),
):
    return session.exec(
        select(LabResult).order_by(LabResult.id.desc()).limit(limit)
    ).all()


@router.get("/recent-results")
def get_recent_results(
    limit: int = 10,
    session: Session = Depends(get_session),
):
    """Get recent lab results with patient info for the home page."""
    results = session.exec(
        select(LabResult).order_by(LabResult.id.desc()).limit(limit)
    ).all()
    return [
        {
            "id": r.id,
            "patient_name": r.patient_name,
            "organism_id": r.organism_id,
            "specimen": r.specimen,
            "hospital": r.hospital,
            "collection_date": r.collection_date,
            "susceptibility": r.susceptibility,
            "entered_by": r.entered_by,
            "created_at": r.created_at,
        }
        for r in results
    ]