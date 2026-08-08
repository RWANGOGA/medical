import os

class Settings:
    PROJECT_NAME: str = "AMR Clinical Decision Support API"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./test.db")

settings = Settings()