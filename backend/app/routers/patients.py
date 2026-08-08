from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.db import get_session
from app.models import Patient

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.get("/", response_model=list[Patient])
def list_patients(session: Session = Depends(get_session)):
    return session.exec(select(Patient)).all()

@router.get("/{patient_id}", response_model=Patient)
def get_patient(patient_id: int, session: Session = Depends(get_session)):
    patient = session.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient