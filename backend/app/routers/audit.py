from typing import List

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.db import get_session
from app.models import AuditLog, User
from app.services.auth import get_current_user

router = APIRouter(prefix="/audit", tags=["Audit Log"])


@router.get("/", response_model=List[AuditLog])
def list_audit_logs(
    limit: int = Query(100, le=500),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    stmt = select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)
    return session.exec(stmt).all()