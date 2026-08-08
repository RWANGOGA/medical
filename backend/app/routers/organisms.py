from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.db import get_session
from app.models import Organism

router = APIRouter(prefix="/organisms", tags=["Organisms"])

@router.get("/", response_model=list[Organism])
def list_organisms(session: Session = Depends(get_session)):
    return session.exec(select(Organism)).all()

@router.get("/{organism_id}", response_model=Organism)
def get_organism(organism_id: str, session: Session = Depends(get_session)):
    organism = session.get(Organism, organism_id)
    if not organism:
        raise HTTPException(status_code=404, detail="Organism not found")
    return organism