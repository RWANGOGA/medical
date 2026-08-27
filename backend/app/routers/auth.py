from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel

from app.db import get_session
from app.models import User
from app.services.auth import (
    hash_password, verify_password, create_access_token, get_current_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    role: str = "doctor"
    hospital: str
    specialization: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    email: str
    full_name: str
    role: str
    hospital: str
    specialization: str


def _to_response(user: User, token: str) -> TokenResponse:
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        hospital=user.hospital,
        specialization=user.specialization or "",
    )


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, session: Session = Depends(get_session)):
    existing = session.exec(
        select(User).where((User.username == payload.username) | (User.email == payload.email))
    ).first()
    if existing:
        # Clear message so you know it's a duplicate, not a crash
        raise HTTPException(
            status_code=400,
            detail=f"Username or email already registered (existing user: {existing.username}). Try logging in instead.",
        )

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        hospital=payload.hospital,
        specialization=payload.specialization,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token(data={"sub": str(user.id)})
    return _to_response(user, token)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == payload.email)).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

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