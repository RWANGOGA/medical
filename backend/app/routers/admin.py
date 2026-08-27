from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import Optional

from app.db import get_session
from app.models import User, Patient
from app.services.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["Admin"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Middleware to require admin role."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required. You do not have permission to perform this action."
        )
    return current_user


@router.get("/dashboard")
def admin_dashboard(
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Admin dashboard statistics."""
    total_doctors = session.exec(
        select(User).where(User.role.in_(["doctor", "lab_attendant"]))
    ).all()
    total_patients = session.exec(select(Patient)).all()
    active_doctors = [d for d in total_doctors if d.is_active]
    
    return {
        "total_doctors": len(total_doctors),
        "active_doctors": len(active_doctors),
        "suspended_doctors": len(total_doctors) - len(active_doctors),
        "total_patients": len(total_patients),
        "total_hospitals": len(set(d.hospital for d in total_doctors if d.hospital)),
    }


@router.get("/doctors")
def list_all_doctors(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,  # active, suspended, all
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """List all doctors with filtering and pagination."""
    query = select(User).where(User.role.in_(["doctor", "lab_attendant"]))
    
    if search:
        query = query.where(
            User.full_name.ilike(f"%{search}%") | 
            User.username.ilike(f"%{search}%") |
            User.hospital.ilike(f"%{search}%")
        )
    
    if status == "active":
        query = query.where(User.is_active == True)
    elif status == "suspended":
        query = query.where(User.is_active == False)
    
    # Order by most recent
    query = query.order_by(User.id.desc()).offset((page - 1) * limit).limit(limit)
    
    doctors = session.exec(query).all()
    
    return {
        "doctors": [
            {
                "id": d.id,
                "username": d.username,
                "full_name": d.full_name,
                "email": d.email,
                "role": d.role,
                "hospital": d.hospital,
                "specialization": d.specialization,
                "is_active": d.is_active,
                "created_at": d.created_at,
            }
            for d in doctors
        ],
        "page": page,
        "limit": limit,
    }


@router.put("/doctors/{doctor_id}/suspend")
def suspend_doctor(
    doctor_id: int,
    reason: str = "",
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Suspend a doctor account."""
    doctor = session.get(User, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if doctor.role == "admin":
        raise HTTPException(status_code=403, detail="Cannot suspend another admin")
    
    doctor.is_active = False
    session.add(doctor)
    session.commit()
    
    return {"status": "suspended", "doctor_id": doctor_id, "reason": reason}


@router.put("/doctors/{doctor_id}/activate")
def activate_doctor(
    doctor_id: int,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Reactivate a suspended doctor account."""
    doctor = session.get(User, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    doctor.is_active = True
    session.add(doctor)
    session.commit()
    
    return {"status": "activated", "doctor_id": doctor_id}


@router.delete("/doctors/{doctor_id}")
def delete_doctor(
    doctor_id: int,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Permanently delete a doctor account."""
    doctor = session.get(User, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if doctor.role == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete another admin")
    if doctor.id == admin.id:
        raise HTTPException(status_code=403, detail="Cannot delete your own account")
    
    session.delete(doctor)
    session.commit()
    
    return {"status": "deleted", "doctor_id": doctor_id}


@router.get("/patients")
def admin_list_patients(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    hospital: Optional[str] = None,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """List all patients with filtering (admin view)."""
    from app.models import Patient
    
    query = select(Patient)
    
    if search:
        query = query.where(
            Patient.name.ilike(f"%{search}%") |
            Patient.national_id.ilike(f"%{search}%") |
            Patient.diagnosis.ilike(f"%{search}%")
        )
    
    if hospital:
        query = query.where(Patient.hospital == hospital)
    
    query = query.order_by(Patient.id.desc()).offset((page - 1) * limit).limit(limit)
    patients = session.exec(query).all()
    
    return {
        "patients": [
            {
                "id": p.id,
                "name": p.name,
                "age": p.age,
                "sex": p.sex,
                "hospital": p.hospital,
                "diagnosis": p.diagnosis,
                "entered_by": p.entered_by,
                "created_at": p.created_at,
            }
            for p in patients
        ],
        "page": page,
        "limit": limit,
    }


@router.delete("/patients/{patient_id}")
def admin_delete_patient(
    patient_id: int,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Delete a patient record (admin only)."""
    from app.models import Patient
    
    patient = session.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    session.delete(patient)
    session.commit()
    
    return {"status": "deleted", "patient_id": patient_id}


@router.put("/users/{user_id}/role")
def change_user_role(
    user_id: int,
    new_role: str,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Change a user's role (promote to admin, demote, etc.)."""
    from app.models import User
    
    if new_role not in ["student", "doctor", "lab_attendant", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.role = new_role
    session.add(user)
    session.commit()
    
    return {"status": "updated", "user_id": user_id, "new_role": new_role}
