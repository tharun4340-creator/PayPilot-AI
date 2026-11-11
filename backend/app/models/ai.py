from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.base import utcnow


class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(120), default="New conversation")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class PendingAction(Base):
    """A financial action PREPARED by the assistant. It does nothing until the user confirms it."""

    __tablename__ = "pending_actions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    conversation_id: Mapped[Optional[int]] = mapped_column(ForeignKey("ai_conversations.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(30))  # payment_request | invoice
    status: Mapped[str] = mapped_column(String(20), default="PENDING")  # PENDING | CONFIRMED | CANCELLED
    payload_json: Mapped[str] = mapped_column(Text)
    warnings_json: Mapped[str] = mapped_column(Text, default="[]")
    result_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("ai_conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(12))
    content: Mapped[str] = mapped_column(Text)
    mode: Mapped[str] = mapped_column(String(8), default="demo")
    tool_calls_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    data_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pending_action_id: Mapped[Optional[int]] = mapped_column(ForeignKey("pending_actions.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
