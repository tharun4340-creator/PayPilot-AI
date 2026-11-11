from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.base import utcnow


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    level: Mapped[str] = mapped_column(String(10), default="info")
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class WebhookEvent(Base):
    """Every verified PayPal webhook. The unique event id makes redelivery harmless."""

    __tablename__ = "webhook_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    paypal_event_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    event_type: Mapped[str] = mapped_column(String(80))
    resource_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    processed: Mapped[bool] = mapped_column(Boolean, default=False)
    payload_json: Mapped[str] = mapped_column(Text)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(60), index=True)
    details: Mapped[str] = mapped_column(Text, default="")
    ip: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
