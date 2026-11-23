import os

from sqlalchemy.pool import QueuePool
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings

db_url = settings.DATABASE_URL
is_sqlite = db_url.startswith("sqlite")

engine_kwargs: dict = {
    "echo": os.getenv("SQL_ECHO", "").lower() in {"1", "true", "yes"},
    "pool_pre_ping": True,
}

if is_sqlite:
    # SQLite does not accept PostgreSQL pool options / SSL arguments.
    connect_args = {"check_same_thread": False}
else:
    is_local_docker = "db:" in db_url or "localhost" in db_url or "127.0.0.1" in db_url
    connect_args = {"connect_timeout": 60}
    if not is_local_docker:
        connect_args["sslmode"] = "require"

    engine_kwargs.update(
        poolclass=QueuePool,
        pool_recycle=3800,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
    )

engine = create_engine(db_url, connect_args=connect_args, **engine_kwargs)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
