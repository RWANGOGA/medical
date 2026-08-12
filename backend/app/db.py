from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import QueuePool
from app.core.config import settings

# Get database URL from your settings (.env file)
db_url = settings.DATABASE_URL

# Dynamically handle SSL: 
# Local Docker Postgres doesn't support SSL out-of-the-box, but Neon requires it.
is_local_docker = "db:" in db_url or "localhost" in db_url or "127.0.0.1" in db_url

connect_args = {"connect_timeout": 10}
if not is_local_docker:
    connect_args["sslmode"] = "require"

engine = create_engine(
    db_url, 
    echo=True,
    pool_pre_ping=True,
    pool_recycle=3800,  # ✅ FIXED: Added missing comma here
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    connect_args=connect_args
)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session