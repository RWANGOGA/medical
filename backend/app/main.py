from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import create_db_and_tables, get_session
from app.core.config import settings
from app.models import Organism, Antibiotic, Patient, TreatmentProtocol
from app.seed import seed_database
from app.models import User, AuditLog
from app.routers import organisms, antibiotics, patients, cds, dashboard, assistant, auth, search, guidelines, lab, chat, translate
from app.routers import organisms, antibiotics, patients, cds, dashboard, assistant, auth, search, guidelines, lab, chat, translate, audit, reports, admin, publications
from app.services import audit as _audit_trails  # noqa: F401  (registers automatic audit logging)
from fastapi import Request, status
from fastapi.responses import JSONResponse
import logging

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    session_gen = get_session()
    session = next(session_gen)
    try:
        seed_database(session)
    finally:
        session.close()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.5.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(organisms.router, prefix="/api/v1")
app.include_router(antibiotics.router, prefix="/api/v1")
app.include_router(patients.router, prefix="/api/v1")
app.include_router(cds.router, prefix="/api/v1")
app.include_router(assistant.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(guidelines.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(translate.router, prefix="/api/v1")
app.include_router(lab.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(publications.router, prefix="/api/v1")

@app.get("/")
def root():
    return {"name": settings.PROJECT_NAME, "docs": "/docs"}

@app.get("/api/v1/health")
def health():
    return {"status": "ok", "database": "healthy"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"message": "An internal server error occurred. Please try again later."},
    )