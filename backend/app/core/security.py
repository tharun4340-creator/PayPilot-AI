"""Password hashing, JWT helpers and a small in-memory rate limiter (pure Python, no web framework)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

_N, _R, _P = 2 ** 14, 8, 1


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def hash_password(password: str) -> str:
    """scrypt (memory-hard) with a random 16-byte salt. Plaintext is never stored."""
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=_N, r=_R, p=_P, dklen=32)
    return f"scrypt${_N}${_R}${_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = base64.b64decode(digest)
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=base64.b64decode(salt),
            n=int(n), r=int(r), p=int(p),
            dklen=len(expected),
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


class TokenError(Exception):
    pass


def token_fingerprint(token: str) -> str:
    """Return a non-reversible identifier suitable for storing in the database."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(subject, secret: str, minutes: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(subject), "iat": now, "exp": now + timedelta(minutes=minutes)}
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_access_token(token: str, secret: str) -> dict:
    try:
        return jwt.decode(token, secret, algorithms=["HS256"], options={"require": ["exp", "sub"]})
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc


class RateLimiter:
    """Sliding-window limiter. In-memory: fine for one process; use Redis for multi-instance deployments."""

    def __init__(self) -> None:
        self._hits: dict = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, limit: int, window_seconds: int, now: Optional[float] = None) -> bool:
        now = time.monotonic() if now is None else now
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= now - window_seconds:
                hits.popleft()
            if len(hits) >= limit:
                return False
            hits.append(now)
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
