"""Database configuration. PostgreSQL via DATABASE_URL, SQLite fallback for local development."""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


_engine = None
_session_factory = None


def get_engine():
    global _engine
    if _engine is None:
        url = get_settings().database_url
        kwargs: dict = {}
        if url.startswith("sqlite"):
            kwargs["connect_args"] = {"check_same_thread": False}
        else:
            kwargs["pool_pre_ping"] = True
        _engine = create_engine(url, **kwargs)
    return _engine


def get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    return _session_factory


def get_db():
    db = get_session_factory()()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    import app.models  # noqa: F401  (register all tables)

    Base.metadata.create_all(bind=get_engine())


def reset_engine() -> None:
    """Used by tests after changing DATABASE_URL."""
    global _engine, _session_factory
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _session_factory = None
