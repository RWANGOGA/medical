from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.db import create_db_and_tables, get_session
from app.core.config import settings
from app.models import Organism, Antibiotic, Patient  # Import so SQLModel sees them
from app.seed import seed_database

from app.routers import organisms, antibiotics, patients

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Create tables
    create_db_and_tables()
    
    # 2. Seed data if empty
    session_gen = get_session()
    session = next(session_gen)
    try:
        seed_database(session)
    finally:
        session.close()
        
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.3.0",
    lifespan=lifespan
)

# Include Routers with the /api/v1 prefix
app.include_router(organisms.router, prefix="/api/v1")
app.include_router(antibiotics.router, prefix="/api/v1")
app.include_router(patients.router, prefix="/api/v1")

@app.get("/")
def root():
    return {"name": settings.PROJECT_NAME, "docs": "/docs"}

@app.get("/api/v1/health")
def health():
    return {"status": "ok", "database": "healthy"}