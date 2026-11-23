from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlmodel import Session, select

from app.db import get_session
from app.models import User
from app.services.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Self-service accounts may never create administrators. Admins are provisioned
# by an existing admin (PUT /admin/users/{id}/role) or during deployment.
SELF_SERVICE_ROLES = {"doctor", "student", "lab_attendant"}


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)
    role: str = "doctor"
    hospital: str = Field(min_length=2, max_length=120)
    specialization: str = ""


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    full_name: str
    role: str
    hospital: str
    specialization: str


def _to_response(user: User, token: str) -> TokenResponse:
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        hospital=user.hospital,
        specialization=user.specialization or "",
    )


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, session: Session = Depends(get_session)):
    username = payload.username.strip()
    email = payload.email.strip().lower()
    role = payload.role.strip().lower() or "doctor"

    if role == "admin":
        raise HTTPException(
            status_code=403,
            detail="Administrator accounts are provisioned by an existing administrator.",
        )
    if role not in SELF_SERVICE_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role for self-registration.")

    # Case-insensitive duplicate detection (avoids Admin vs admin lookalikes).
    existing = session.exec(
        select(User).where(
            (func.lower(User.username) == username.lower()) | (User.email == email)
        )
    ).first()
    if existing:
        # Do not reveal which account matched: that enables user enumeration.
        raise HTTPException(
            status_code=400,
            detail="Username or email already registered. Try logging in instead.",
        )

    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role=role,
        hospital=payload.hospital.strip(),
        specialization=payload.specialization.strip(),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token(data={"sub": str(user.id)})
    return _to_response(user, token)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, session: Session = Depends(get_session)):
    username = payload.username.strip()
    user = session.exec(
        select(User).where(func.lower(User.username) == username.lower())
    ).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="This account has been suspended. Contact an administrator.",
        )

    token = create_access_token(data={"sub": str(user.id)})
    return _to_response(user, token)


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "hospital": current_user.hospital,
        "specialization": current_user.specialization or "",
    }
