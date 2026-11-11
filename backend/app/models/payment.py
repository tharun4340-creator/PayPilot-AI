from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.base import utcnow


class Payment(Base):
    """A payment request. Only `paypal_*` fields read back from PayPal can mark it COMPLETED."""

    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_payment_user_idempotency"),
        CheckConstraint("amount > 0", name="ck_payment_amount_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    invoice_id: Mapped[Optional[int]] = mapped_column(ForeignKey("invoices.id"), nullable=True, index=True)
    description: Mapped[str] = mapped_column(String(240))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3))
    status: Mapped[str] = mapped_column(String(20), default="CREATED", index=True)
    paypal_order_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True, index=True)
    approval_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    paypal_capture_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    paypal_status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(20), default="manual")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    customer: Mapped["Customer"] = relationship("Customer")  # noqa: F821
    invoice: Mapped[Optional["Invoice"]] = relationship("Invoice", back_populates="payments")  # noqa: F821
    events: Mapped[List["Transaction"]] = relationship(
        back_populates="payment", cascade="all, delete-orphan", order_by="Transaction.id"
    )


class Transaction(Base):
    """Immutable event log for a payment (order created, verified, captured, webhook ...)."""

    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    payment_id: Mapped[int] = mapped_column(ForeignKey("payments.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    message: Mapped[str] = mapped_column(Text)
    raw_status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    payment: Mapped[Payment] = relationship(back_populates="events")
