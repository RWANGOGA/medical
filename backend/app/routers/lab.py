from datetime import datetime, timezone
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select, or_

from app.db import get_session
from app.models import LabResult, Patient, User
from app.routers.patients import _scope_to_hospital
from app.services.auth import get_current_user
from app.services.surveillance import (
    ORIGINS,
    ORIGIN_LABELS,
    duplicate_of,
    patient_key,
    quality_indicators,
)

router = APIRouter(prefix="/lab", tags=["Laboratory"])


class LabResultCreate(BaseModel):
    patient_name: str = ""
    organism_id: str
    specimen: str = ""
    hospital: str = ""
    collection_date: str = ""
    susceptibility: Dict[str, str] = {}
    patient_id: Optional[int] = None
    infection_origin: str = Field(
        "unknown",
        description="community, hospital-onset, healthcare-associated or unknown",
    )
    ast_standard: str = Field(
        "", description="Breakpoint standard used, e.g. EUCAST 2025 or CLSI M100 Ed34"
    )


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

    origin = payload.infection_origin.strip().lower()
    if origin not in ORIGINS:
        raise HTTPException(
            status_code=422,
            detail=f"infection_origin must be one of: {', '.join(sorted(ORIGINS))}",
        )

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

    collection_date = payload.collection_date or datetime.now(timezone.utc).strftime(
        "%Y-%m-%d"
    )
    result = LabResult(
        patient_name=payload.patient_name,
        organism_id=payload.organism_id,
        specimen=payload.specimen,
        hospital=hospital,
        collection_date=collection_date,
        susceptibility=payload.susceptibility,
        entered_by=current_user.username,
        patient_id=linked_patient_id,
        patient_key=patient_key(linked_patient_id, payload.patient_name, hospital),
        infection_origin=origin,
        ast_standard=payload.ast_standard.strip(),
    )

    # GLASS first-isolate rule: repeat isolates from the same patient, pathogen
    # and specimen within a year are retained for clinical review but excluded
    # from resistance percentages.
    candidates = session.exec(
        select(LabResult).where(LabResult.organism_id == payload.organism_id)
    ).all()
    prior = duplicate_of(result, candidates)
    result.is_first_isolate = prior is None
    result.duplicate_of = prior

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
            "is_first_isolate": r.is_first_isolate,
            "duplicate_of": r.duplicate_of,
            "infection_origin": r.infection_origin,
            "infection_origin_label": ORIGIN_LABELS.get(
                r.infection_origin, "Not recorded"
            ),
            "ast_standard": r.ast_standard,
        }
        for r in results
    ]
