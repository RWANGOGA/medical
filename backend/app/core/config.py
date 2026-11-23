import os
import secrets
import warnings


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if raw is None:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


class Settings:
    PROJECT_NAME: str = "AMR Clinical Decision Support API"
    VERSION: str = "0.6.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").strip().lower()
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./amr.db")

    # Wildcard is convenient for local development but never for production.
    CORS_ORIGINS: list[str] = _env_list(
        "CORS_ORIGINS",
        ["*"]
        if ENVIRONMENT != "production"
        else ["https://rwangoga.github.io"],
    )

    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24))
    )

    # Demo credentials are opt-in: never ship a known admin password.
    SEED_DEMO_USERS: bool = _env_bool("SEED_DEMO_USERS", False)
    SEED_ADMIN_PASSWORD: str = os.getenv("SEED_ADMIN_PASSWORD", "")
    SEED_DOCTOR_PASSWORD: str = os.getenv("SEED_DOCTOR_PASSWORD", "")

    def __init__(self) -> None:
        if not self.JWT_SECRET:
            if self.ENVIRONMENT == "production":
                raise RuntimeError(
                    "JWT_SECRET must be set when ENVIRONMENT=production."
                )
            # A random per-process secret is safer than a public default, but it
            # means tokens are invalidated whenever the server restarts.
            self.JWT_SECRET = secrets.token_urlsafe(48)
            warnings.warn(
                "JWT_SECRET is not set. Generated an ephemeral development secret; "
                "existing sessions will be invalidated on restart. "
                "Set JWT_SECRET in every deployed environment.",
                RuntimeWarning,
                stacklevel=2,
            )


settings = Settings()
