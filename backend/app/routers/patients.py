from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db import get_session
from app.models import Patient, User
from app.services.auth import get_current_user

router = APIRouter(prefix="/patients", tags=["Patients"])


# ============================================================
# REQUEST / RESPONSE MODELS
# ============================================================

class PatientCreate(BaseModel):
    name: str
    national_id: Optional[str] = ""
    hospital: Optional[str] = ""
    age: int
    sex: str = "M"
    weight_kg: Optional[float] = None
    pregnancy_status: Optional[str] = "Not pregnant"
    allergies: List[str] = []
    renal_function: Optional[str] = "Normal"
    liver_function: Optional[str] = "Normal"
    diagnosis: str
    infection_site: Optional[str] = ""
    culture_results: Optional[str] = ""
    antibiotic_timeline: List[dict] = []


class PatientUpdate(BaseModel):
    name: Optional[str] = None
    national_id: Optional[str] = None
    hospital: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    weight_kg: Optional[float] = None
    pregnancy_status: Optional[str] = None
    allergies: Optional[List[str]] = None
    renal_function: Optional[str] = None
    liver_function: Optional[str] = None
    immunocompromised: Optional[bool] = None
    diagnosis: Optional[str] = None
    infection_site: Optional[str] = None
    culture_results: Optional[str] = None
    antibiotic_timeline: Optional[List[dict]] = None


class DuplicateCheckRequest(BaseModel):
    name: str
    age: Optional[int] = None
    sex: Optional[str] = None
    national_id: Optional[str] = ""


class DuplicateMatch(BaseModel):
    id: int
    name: str
    age: int
    sex: str
    hospital: str
    national_id: str
    risk: str  # "high" or "medium"


class DuplicateCheckResponse(BaseModel):
    is_duplicate: bool
    risk_level: str  # "none" | "medium" | "high"
    matches: List[DuplicateMatch]


# ============================================================
# ENDPOINTS
# ============================================================

@router.get("/", response_model=List[Patient])
def list_patients(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return session.exec(select(Patient)).all()


@router.get("/{patient_id}", response_model=Patient)
def get_patient(
    patient_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    patient = session.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.post("/", response_model=Patient)
def create_patient(
    payload: PatientCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Use the logged-in doctor's hospital if none provided
    hospital = payload.hospital or current_user.hospital or ""
    
    patient = Patient(
        name=payload.name,
        national_id=payload.national_id or "",
        hospital=hospital,
        age=payload.age,
        sex=payload.sex,
        weight_kg=payload.weight_kg,
        pregnancy_status=payload.pregnancy_status,
        allergies=payload.allergies,
        renal_function=payload.renal_function,
        liver_function=payload.liver_function,
        diagnosis=payload.diagnosis,
        infection_site=payload.infection_site or "",
        culture_results=payload.culture_results or "",
        antibiotic_timeline=payload.antibiotic_timeline,
    )
    session.add(patient)
    session.commit()
    session.refresh(patient)
    return patient


@router.put("/{patient_id}", response_model=Patient)
def update_patient(
    patient_id: int,
    payload: PatientUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    patient = session.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Apply only the fields that were provided
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(patient, field, value)

    session.add(patient)
    session.commit()
    session.refresh(patient)
    return patient


@router.post("/check-duplicate", response_model=DuplicateCheckResponse)
def check_duplicate(
    payload: DuplicateCheckRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    name = (payload.name or "").strip().lower()
    if not name:
        return DuplicateCheckResponse(is_duplicate=False, risk_level="none", matches=[])

    # Find candidates by similar name OR same national ID
    candidates = list(session.exec(
        select(Patient).where(Patient.name.ilike(f"%{name}%"))
    ).all())

    if payload.national_id:
        for p in session.exec(
            select(Patient).where(Patient.national_id == payload.national_id)
        ).all():
            if p.id not in [c.id for c in candidates]:
                candidates.append(p)

    risk_level = "none"
    matches = []

    for p in candidates:
        p_name = (p.name or "").strip().lower()
        same_name = p_name == name
        same_age = payload.age is not None and p.age == payload.age
        same_sex = (p.sex or "").lower() == (payload.sex or "").lower()
        same_id = (
            bool(payload.national_id)
            and (p.national_id or "").lower() == payload.national_id.lower()
        )

        # HIGH = same ID, or same name + age + sex (almost certainly the same person)
        if same_id or (same_name and same_age and same_sex):
            risk = "high"
        # MEDIUM = same or overlapping name (possibly the same person)
        elif same_name or name in p_name or p_name in name:
            risk = "medium"
        else:
            continue

        if risk == "high":
            risk_level = "high"
        elif risk == "medium" and risk_level != "high":
            risk_level = "medium"

        matches.append(DuplicateMatch(
            id=p.id,
            name=p.name,
            age=p.age,
            sex=p.sex,
            hospital=p.hospital,
            national_id=p.national_id or "",
            risk=risk,
        ))

    return DuplicateCheckResponse(
        is_duplicate=len(matches) > 0,
        risk_level=risk_level,
        matches=matches,
    )


@router.delete("/{patient_id}")
def delete_patient(
    patient_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    patient = session.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    session.delete(patient)
    session.commit()
    return {"status": "deleted"}