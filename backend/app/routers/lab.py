from datetime import datetime, timezone
from typing import Dict, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select, or_

from app.db import get_session
from app.models import LabResult, Patient, User
from app.routers.patients import _scope_to_hospital
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


def _scope_lab_results(stmt, current_user: User):
    """Admins see the whole network; clinicians see their hospital and their
    own entries. Patient names and susceptibility data are not public."""
    if current_user.role == "admin":
        return stmt
    conditions = []
    if current_user.hospital:
        conditions.append(LabResult.hospital == current_user.hospital)
    if current_user.username:
        conditions.append(LabResult.entered_by == current_user.username)
    if not conditions:
        return stmt.where(LabResult.id == -1)
    return stmt.where(or_(*conditions))


@router.post("/results")
def create_lab_result(
    payload: LabResultCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Default to the caller's hospital, but respect an explicit site.
    hospital = payload.hospital or current_user.hospital or ""

    # Link to an existing patient the caller can access, or create one.
    linked_patient_id = payload.patient_id
    if linked_patient_id:
        linked = session.get(Patient, linked_patient_id)
        if linked is None:
            linked_patient_id = None
    if not linked_patient_id and payload.patient_name:
        existing = session.exec(
            _scope_to_hospital(
                select(Patient).where(
                    Patient.name.ilike(payload.patient_name.strip())
                ),
                current_user,
            )
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
        collection_date=payload.collection_date
        or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
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
    current_user: User = Depends(get_current_user),
):
    stmt = _scope_lab_results(
        select(LabResult).order_by(LabResult.id.desc()), current_user
    ).limit(limit)
    return session.exec(stmt).all()


@router.get("/recent-results")
def get_recent_results(
    limit: int = 10,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get recent lab results with patient info for the home page."""
    stmt = _scope_lab_results(
        select(LabResult).order_by(LabResult.id.desc()), current_user
    ).limit(limit)
    results = session.exec(stmt).all()
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
