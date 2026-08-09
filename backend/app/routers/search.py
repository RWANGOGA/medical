from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from pydantic import BaseModel

from app.db import get_session
from app.models import Patient, User
from app.services.auth import get_current_user

router = APIRouter(prefix="/search", tags=["Search"])


class SearchRequest(BaseModel):
    query: str


class PatientMatch(BaseModel):
    id: int
    name: str
    age: int
    sex: str
    hospital: str
    diagnosis: str
    national_id: str


class SearchResponse(BaseModel):
    patients: list[PatientMatch]
    duplicate_warning: str | None = None


@router.post("/patients", response_model=SearchResponse)
def search_patients(
    payload: SearchRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    q = payload.query.strip()
    if not q:
        return SearchResponse(patients=[], duplicate_warning=None)

    # Use ilike for case-insensitive search (works in PostgreSQL and SQLite)
    query_lower = f"%{q.lower()}%"

    statement = select(Patient).where(
        (Patient.name.ilike(query_lower)) |
        (Patient.national_id.ilike(query_lower)) |
        (Patient.diagnosis.ilike(query_lower))
    )

    patients = session.exec(statement).all()

    # Build duplicate warning if we found matches
    warning = None
    if patients:
        exact_matches = [p for p in patients if p.name.lower() == q.lower()]
        if exact_matches:
            warning = (
                f"Exact name match found with {len(exact_matches)} patient(s). "
                "Please verify before creating a new record."
            )

    return SearchResponse(
        patients=[
            PatientMatch(
                id=p.id,
                name=p.name,
                age=p.age,
                sex=p.sex,
                hospital=p.hospital,
                diagnosis=p.diagnosis,
                national_id=p.national_id or "",
            )
            for p in patients
        ],
        duplicate_warning=warning,
    )