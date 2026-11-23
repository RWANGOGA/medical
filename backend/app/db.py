import os

from sqlalchemy import inspect, text
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
    _ensure_new_columns()


def _ensure_new_columns() -> None:
    """Add columns introduced after the first release to existing tables.

    create_all() never alters an existing table, so without this the new GLASS
    surveillance fields would be missing on deployments that already have a
    database. Every statement is additive and idempotent.
    """
    dialect = engine.dialect.name
    bool_true = "1" if dialect == "sqlite" else "TRUE"

    additions = {
        "labresult": {
            "patient_key": "VARCHAR DEFAULT ''",
            "is_first_isolate": f"BOOLEAN DEFAULT {bool_true}",
            "duplicate_of": "INTEGER DEFAULT NULL",
            "infection_origin": "VARCHAR DEFAULT 'unknown'",
            "ast_standard": "VARCHAR DEFAULT ''",
        },
    }

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    lab_present = (
        {column["name"] for column in inspector.get_columns("labresult")}
        if "labresult" in tables
        else set()
    )
    with engine.begin() as conn:
        for table, columns in additions.items():
            if table not in tables:
                continue  # create_all() just made it with every column.
            present = (
                lab_present
                if table == "labresult"
                else {column["name"] for column in inspector.get_columns(table)}
            )
            for column, definition in columns.items():
                if column not in present:
                    conn.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
                    )
        if "labresult" in tables and "patient_key" not in lab_present:
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_labresult_patient_key "
                    "ON labresult (patient_key)"
                )
            )


def get_session():
    with Session(engine) as session:
        yield session
