from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.db import create_db_and_tables
from app.core.config import settings

# This runs when the app starts up
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables
    create_db_and_tables()
    print("✅ Database tables created successfully!")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.2.0",
    lifespan=lifespan
)

@app.get("/")
def root():
    return {
        "name": settings.PROJECT_NAME,
        "docs": "/docs",
        "database": "Connected to PostgreSQL"
    }

@app.get("/api/v1/health")
def health():
    return {"status": "ok", "database": "healthy"}