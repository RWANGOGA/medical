from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import event
from sqlmodel import Session

from app.models import AuditLog, Patient, LabResult

# Holds the authenticated user for the current request
_current_user: ContextVar[Optional[object]] = ContextVar("audit_user", default=None)


def set_audit_user(user) -> None:
    """Called by get_current_user so auto-logs know WHO did the action."""
    _current_user.set(user)


def _who():
    user = _current_user.get()
    return (getattr(user, "id", 0) or 0, getattr(user, "username", "system") or "system")


def log_action(session: Session, action: str, patient_id: Optional[int] = None, details: str = "") -> None:
    """Manual logging helper (for login, reports, etc.)."""
    uid, uname = _who()
    session.add(AuditLog(user_id=uid, username=uname, action=action, patient_id=patient_id, details=details))


def _now():
    return datetime.now(timezone.utc).isoformat()


# --- Automatic listeners: patient & lab activity ---
@event.listens_for(Patient, "after_insert")
def _patient_added(mapper, connection, target):
    uid, uname = _who()
    connection.execute(
        AuditLog.__table__.insert().values(
            user_id=uid, username=uname, action="created patient",
            patient_id=target.id,
            details=f"Patient '{target.name}' added ({target.hospital or 'no hospital'})",
            timestamp=_now(),
        )
    )


@event.listens_for(Patient, "after_update")
def _patient_updated(mapper, connection, target):
    uid, uname = _who()
    connection.execute(
        AuditLog.__table__.insert().values(
            user_id=uid, username=uname, action="updated patient",
            patient_id=target.id, details=f"Patient '{target.name}' record updated",
            timestamp=_now(),
        )
    )


@event.listens_for(LabResult, "after_insert")
def _lab_added(mapper, connection, target):
    uid, uname = _who()
    connection.execute(
        AuditLog.__table__.insert().values(
            user_id=uid, username=uname, action="entered lab result",
            patient_id=None,
            details=f"Lab result for {target.patient_name or 'unknown'} — {target.organism_id} ({target.hospital or 'no hospital'})",
            timestamp=_now(),
        )
    )