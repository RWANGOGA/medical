from sqlmodel import SQLModel, create_engine, Session
from app.core.config import settings # We will create this in a second

# Create the database engine
engine = create_engine(settings.DATABASE_URL, echo=False)

# Dependency to get the database session
def get_session():
    with Session(engine) as session:
        yield session

# Function to create all tables
def create_db_and_tables():
    SQLModel.metadata.create_all(engine)