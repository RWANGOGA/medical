from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.db import get_session
from app.models import Antibiotic

router = APIRouter(prefix="/antibiotics", tags=["Antibiotics"])

@router.get("/", response_model=list[Antibiotic])
def list_antibiotics(session: Session = Depends(get_session)):
    return session.exec(select(Antibiotic)).all()

@router.get("/{antibiotic_id}", response_model=Antibiotic)
def get_antibiotic(antibiotic_id: str, session: Session = Depends(get_session)):
    antibiotic = session.get(Antibiotic, antibiotic_id)
    if not antibiotic:
        raise HTTPException(status_code=404, detail="Antibiotic not found")
    return antibiotic