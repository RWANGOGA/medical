"""
Shared pytest fixtures for the AMR CDS backend.

The app is configured for PostgreSQL in production, so this module must run
BEFORE any `app.*` import:

1. Point DATABASE_URL at a throw-away SQLite file.
2. Blank GROQ_API_KEY so AI endpoints hit their deterministic offline fallback.
3. Patch `sqlmodel.create_engine` to drop Postgres-only pooling options when
   the URL is SQLite (the app module passes them unconditionally).
"""

import os
import tempfile

# --- 1. Test environment (must happen before the app is imported) ---
TEST_DB_PATH = os.path.join(tempfile.gettempdir(), "amr_cds_test.db")
if os.path.exists(TEST_DB_PATH):
    os.remove(TEST_DB_PATH)

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["GROQ_API_KEY"] = ""  # forces the assistant's neutral fallback reply
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production")

# --- 2. Make create_engine SQLite-compatible ---
import sqlmodel

_real_create_engine = sqlmodel.create_engine


def _sqlite_safe_create_engine(url, *args, **kwargs):
    if str(url).startswith("sqlite"):
        for key in (
            "connect_args", "poolclass", "pool_size", "max_overflow",
            "pool_timeout", "pool_recycle", "pool_pre_ping",
        ):
            kwargs.pop(key, None)
        kwargs["connect_args"] = {"check_same_thread": False}
    return _real_create_engine(url, *args, **kwargs)


sqlmodel.create_engine = _sqlite_safe_create_engine

# --- 3. App imports (after env + engine patch) ---
import pytest
from fastapi.testclient import TestClient

from app.main import app
import app.db as app_db

app_db.engine.echo = False  # keep test output readable

DEMO_DOCTOR = {
    "username": "test.doctor",
    "email": "test.doctor@example.org",
    "password": "test-password-123",
    "full_name": "Test Doctor",
    "role": "doctor",
    "hospital": "Test Hospital",
    "specialization": "Infectious Diseases",
}


@pytest.fixture(scope="session")
def client():
    # Context manager triggers the FastAPI lifespan (tables + seed data).
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def auth_headers(client):
    """Registers a dedicated test user once and returns auth headers."""
    res = client.post("/api/v1/auth/register", json=DEMO_DOCTOR)
    assert res.status_code == 200, res.text
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
