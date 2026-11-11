"""FastAPI dependencies: auth, rate limiting, and PayPal/LLM clients (overridable in tests)."""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select

from app.core.config import Settings, get_settings
from app.core.security import RateLimiter, TokenError, decode_access_token, token_fingerprint
from app.database.session import get_db
from app.models import AuditLog, User
from app.services.llm import LLMClient
from app.services.paypal_client import PayPalClient

_bearer = HTTPBearer(auto_error=False)
_limiter = RateLimiter()


def reset_rate_limits() -> None:
    _limiter.reset()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def rate_limit(name: str, limit: int, window: int = 60):
    def dep(request: Request):
        if not _limiter.allow(f"{name}:{client_ip(request)}", limit, window):
            raise HTTPException(429, "Too many requests. Please wait a moment and try again.")
    return dep


def get_current_user(request: Request, creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer), db=Depends(get_db),
                     settings: Settings = Depends(get_settings)) -> User:
    if not creds:
        raise HTTPException(401, "Please sign in to continue.")
    try:
        payload = decode_access_token(creds.credentials, settings.secret_key)
        fingerprint = token_fingerprint(creds.credentials)
        request.state.token_fingerprint = fingerprint
        user_id = int(payload["sub"])
        if db.scalar(select(AuditLog.id).where(
            AuditLog.user_id == user_id,
            AuditLog.action == "auth.token_revoked",
            AuditLog.details == fingerprint,
        )):
            raise HTTPException(401, "Your session has expired. Please sign in again.")
        user = db.get(User, user_id)
    except (TokenError, ValueError, KeyError, TypeError):
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    if not user or not user.is_active:
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    return user


@lru_cache(maxsize=4)
def _paypal(client_id: str, secret: str, env: str) -> PayPalClient:
    return PayPalClient(client_id, secret, env)


def get_paypal(settings: Settings = Depends(get_settings)) -> Optional[PayPalClient]:
    return _paypal(settings.paypal_client_id, settings.paypal_client_secret, settings.paypal_env) if settings.paypal_configured else None


@lru_cache(maxsize=4)
def _llm(provider: str, key: str, model: str, base: str) -> LLMClient:
    return LLMClient(provider, key, model, base)


def get_llm(settings: Settings = Depends(get_settings)) -> Optional[LLMClient]:
    return _llm(settings.llm_provider, settings.llm_api_key, settings.llm_model, settings.llm_base_url) if settings.llm_configured else None
