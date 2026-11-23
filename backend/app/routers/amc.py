"""Antimicrobial consumption recording and GLASS-AMC reporting."""

import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select, or_

from app.db import get_session
from app.models import Antibiotic, AntibioticUse, HospitalActivity, Patient, User
from app.services.amc import summarise
from app.services.auth import get_current_user

router = APIRouter(prefix="/amc", tags=["Antimicrobial Consumption"])

PERIOD_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


class UseCreate(BaseModel):
    antibiotic_id: str
    patient_id: Optional[int] = None
    hospital: str = ""
    unit: str = ""
    start_date: str = ""
    end_date: str = ""
    duration_days: int = 0
    daily_dose_mg: Optional[float] = None
    route: str = ""
    indication: str = ""


class ActivityCreate(BaseModel):
    hospital: str
    period: str = Field(description="YYYY-MM")
    patient_days: int = 0
    admissions: int = 0
    population: int = 0


def _scope_uses(stmt, current_user: User):
    if current_user.role == "admin":
        return stmt
    conditions = []
    if current_user.hospital:
        conditions.append(AntibioticUse.hospital == current_user.hospital)
    if current_user.username:
        conditions.append(AntibioticUse.entered_by == current_user.username)
    if not conditions:
        return stmt.where(AntibioticUse.id == -1)
    return stmt.where(or_(*conditions))


def _assert_hospital(hospital: str, current_user: User) -> None:
    if (
        current_user.role != "admin"
        and current_user.hospital
        and hospital != current_user.hospital
    ):
        raise HTTPException(
            status_code=403, detail="You can only record data for your own hospital."
        )


def _month(value: str) -> bool:
    return bool(PERIOD_RE.match((value or "")[:7]))


@router.post("/use")
def record_use(
    payload: UseCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    drug = session.get(Antibiotic, payload.antibiotic_id)
    if not drug:
        raise HTTPException(status_code=404, detail="Unknown antibiotic.")

    hospital = payload.hospital or current_user.hospital or ""
    _assert_hospital(hospital, current_user)

    start = payload.start_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not _month(start):
        raise HTTPException(status_code=422, detail="start_date must be a valid date.")

    patient_id = payload.patient_id
    if patient_id:
        patient = session.get(Patient, patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Unknown patient.")
        _assert_hospital(patient.hospital, current_user)

    days = payload.duration_days
    if days < 0:
        raise HTTPException(status_code=422, detail="duration_days cannot be negative.")
    if days == 0 and payload.end_date:
        try:
            days = (
                datetime.fromisoformat(payload.end_date[:10]).date()
                - datetime.fromisoformat(start[:10]).date()
            ).days + 1
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid end_date.")
    if days <= 0:
        raise HTTPException(
            status_code=422, detail="Provide duration_days or a valid end_date."
        )
    if payload.daily_dose_mg is not None and payload.daily_dose_mg <= 0:
        raise HTTPException(status_code=422, detail="daily_dose_mg must be positive.")

    use = AntibioticUse(
        antibiotic_id=payload.antibiotic_id,
        patient_id=patient_id,
        hospital=hospital,
        unit=payload.unit.strip(),
        start_date=start,
        end_date=payload.end_date,
        duration_days=days,
        daily_dose_mg=payload.daily_dose_mg,
        route=payload.route.strip(),
        indication=payload.indication.strip(),
        estimated_ddd=payload.daily_dose_mg is None or not drug.ddd_value_mg,
        entered_by=current_user.username,
    )
    session.add(use)
    session.commit()
    session.refresh(use)
    return use


@router.get("/use")
def list_use(
    limit: int = 50,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    stmt = _scope_uses(
        select(AntibioticUse).order_by(AntibioticUse.id.desc()), current_user
    ).limit(min(limit, 200))
    return session.exec(stmt).all()


@router.post("/activity")
def record_activity(
    payload: ActivityCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Upsert the monthly patient-day denominator for a facility."""
    hospital = payload.hospital.strip()
    _assert_hospital(hospital, current_user)
    if not hospital or not _month(payload.period):
        raise HTTPException(status_code=422, detail="hospital and YYYY-MM period are required.")
    if min(payload.patient_days, payload.admissions, payload.population) < 0:
        raise HTTPException(status_code=422, detail="Counts cannot be negative.")

    existing = session.exec(
        select(HospitalActivity).where(
            HospitalActivity.hospital == hospital,
            HospitalActivity.period == payload.period[:7],
        )
    ).first()
    if existing:
        existing.patient_days = payload.patient_days
        existing.admissions = payload.admissions
        existing.population = payload.population
        existing.entered_by = current_user.username
        activity = existing
    else:
        activity = HospitalActivity(
            hospital=hospital,
            period=payload.period[:7],
            patient_days=payload.patient_days,
            admissions=payload.admissions,
            population=payload.population,
            entered_by=current_user.username,
        )
        session.add(activity)
    session.commit()
    session.refresh(activity)
    return activity


@router.get("/activity")
def list_activity(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    stmt = select(HospitalActivity)
    if current_user.role != "admin":
        stmt = stmt.where(HospitalActivity.hospital == (current_user.hospital or ""))
    return session.exec(stmt.order_by(HospitalActivity.period.desc())).all()


@router.get("/summary")
def consumption_summary(
    hospital: Optional[str] = None,
    from_month: Optional[str] = None,
    to_month: Optional[str] = None,
    session: Session = Depends(get_session),
):
    """Aggregate consumption. No patient identifiers are returned."""
    uses = session.exec(select(AntibioticUse)).all()
    if hospital:
        uses = [u for u in uses if u.hospital == hospital]
    if from_month:
        uses = [u for u in uses if (u.start_date or u.created_at)[:7] >= from_month]
    if to_month:
        uses = [u for u in uses if (u.start_date or u.created_at)[:7] <= to_month]

    activity = session.exec(select(HospitalActivity)).all()
    if hospital:
        activity = [a for a in activity if a.hospital == hospital]
    if from_month:
        activity = [a for a in activity if a.period >= from_month]
    if to_month:
        activity = [a for a in activity if a.period <= to_month]

    return summarise(uses, activity, session.exec(select(Antibiotic)).all())
