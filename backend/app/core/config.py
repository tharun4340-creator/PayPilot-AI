"""Environment-based configuration. No secrets are ever hard-coded here."""
from __future__ import annotations

import logging
import os
import secrets
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

log = logging.getLogger("paypilot.config")


def _parse_env_file(path: Path) -> dict:
    values: dict = {}
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return values
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key] = value
    return values


def load_dotenv() -> None:
    """Load backend/.env and then the repo-root .env (real env vars always win)."""
    if os.environ.get("PAYPILOT_SKIP_DOTENV") == "1":
        return
    backend_dir = Path(__file__).resolve().parents[2]
    for candidate in (backend_dir / ".env", backend_dir.parent / ".env"):
        for key, value in _parse_env_file(candidate).items():
            os.environ.setdefault(key, value)


def _env(name: str, default: str = "") -> str:
    value = os.environ.get(name)
    return value.strip() if value and value.strip() else default


def _int(name: str, default: int) -> int:
    try:
        return int(_env(name, str(default)))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    app_env: str
    secret_key: str
    access_token_minutes: int
    database_url: str
    auto_create_tables: bool
    cors_origins: tuple
    frontend_url: str
    paypal_client_id: str
    paypal_client_secret: str
    paypal_env: str
    paypal_webhook_id: str
    paypal_default_currency: str
    llm_provider: str
    llm_api_key: str
    llm_model: str
    llm_base_url: str

    @property
    def paypal_configured(self) -> bool:
        return bool(self.paypal_client_id and self.paypal_client_secret)

    @property
    def llm_configured(self) -> bool:
        return bool(self.llm_provider in ("anthropic", "openai", "meta", "google") and self.llm_api_key)

    @property
    def mode(self) -> str:
        if not self.paypal_configured:
            return "demo"
        return "live" if self.paypal_env == "live" else "sandbox"

    @classmethod
    def from_env(cls) -> "Settings":
        app_env = _env("APP_ENV", "development")
        secret = _env("SECRET_KEY")
        if not secret:
            if app_env == "production":
                raise RuntimeError("SECRET_KEY must be set when APP_ENV=production.")
            secret = secrets.token_urlsafe(48)
            log.warning("SECRET_KEY is not set; using a temporary key. Logins reset on every restart.")
        db_url = _env("DATABASE_URL", "sqlite:///./paypilot.db")
        if db_url.startswith("postgres://"):
            db_url = "postgresql://" + db_url[len("postgres://"):]
        provider = _env("LLM_PROVIDER").lower()
        default_model = {
            "anthropic": "claude-sonnet-5-5",
            "openai": "gpt-4o-mini",
            "meta": "muse-spark-1.3",
            "google": "gemini-3.8-flash",
        }.get(provider, "")
        default_base_url = "https://api.meta.ai/v1" if provider == "meta" else ""
        origins = tuple(
            o.strip() for o in _env("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()
        )
        paypal_env = _env("PAYPAL_ENV", "sandbox").lower()
        if paypal_env not in ("sandbox", "live"):
            paypal_env = "sandbox"
        return cls(
            app_env=app_env,
            secret_key=secret,
            access_token_minutes=_int("ACCESS_TOKEN_MINUTES", 480),
            database_url=db_url,
            auto_create_tables=_env("AUTO_CREATE_TABLES", "true").lower() in ("1", "true", "yes"),
            cors_origins=origins,
            frontend_url=_env("FRONTEND_URL", _env("RENDER_EXTERNAL_URL", "http://localhost:5173")).rstrip("/"),
            paypal_client_id=_env("PAYPAL_CLIENT_ID"),
            paypal_client_secret=_env("PAYPAL_CLIENT_SECRET"),
            paypal_env=paypal_env,
            paypal_webhook_id=_env("PAYPAL_WEBHOOK_ID"),
            paypal_default_currency=_env("PAYPAL_DEFAULT_CURRENCY", "USD").upper(),
            llm_provider=provider,
            llm_api_key=_env("LLM_API_KEY"),
            llm_model=_env("LLM_MODEL", default_model),
            llm_base_url=_env("LLM_BASE_URL", default_base_url),
        )


@lru_cache
def get_settings() -> Settings:
    load_dotenv()
    return Settings.from_env()
