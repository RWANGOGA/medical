from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import QueuePool
from app.core.config import settings
import os

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")

# Configure engine with proper SSL and pooling for Neon
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,  # Recycle connections every 30 minutes (Neon closes idle connections)
    pool_pre_ping=True,  # Test connections before using them
    connect_args={
        "sslmode": "require",
        "connect_timeout": 10,
    }
)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session