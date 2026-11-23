import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlmodel import Session

from app.core.config import settings
from app.db import engine, create_db_and_tables, get_session
from app.routers import (
    admin,
    antibiotics,
    assistant,
    audit,
    auth,
    cds,
    chat,
    dashboard,
    guidelines,
    lab,
    organisms,
    patients,
    publications,
    reports,
    search,
    translate,
)
from app.seed import seed_database
from app.services import audit as _audit_trails  # noqa: F401  (registers audit logging)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    with Session(engine) as session:
        seed_database(session)
    yield


app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    organisms.router,
    antibiotics.router,
    patients.router,
    cds.router,
    assistant.router,
    dashboard.router,
    auth.router,
    search.router,
    guidelines.router,
    chat.router,
    translate.router,
    lab.router,
    audit.router,
    reports.router,
    admin.router,
    publications.router,
):
    app.include_router(router, prefix="/api/v1")


@app.get("/")
def root():
    return {"name": settings.PROJECT_NAME, "docs": "/docs"}


@app.get("/api/v1/health")
def health(session: Session = Depends(get_session)):
    try:
        session.exec(text("SELECT 1"))
        database = "healthy"
    except Exception:  # pragma: no cover - depends on the deployment database
        logger.exception("Database health check failed")
        database = "unavailable"

    return {
        "status": "ok" if database == "healthy" else "degraded",
        "database": database,
        "version": app.version,
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"message": "An internal server error occurred. Please try again later."},
    )
