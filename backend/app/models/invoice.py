from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.base import utcnow


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("user_id", "number", name="uq_invoice_user_number"),
        CheckConstraint("total >= 0", name="ck_invoice_total_nonneg"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    number: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20), default="UNPAID", index=True)  # DRAFT|UNPAID|PAID|CANCELLED
    issue_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)
    currency: Mapped[str] = mapped_column(String(3))
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    paypal_invoice_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    paypal_invoice_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    paypal_invoice_status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    customer: Mapped["Customer"] = relationship("Customer")  # noqa: F821
    items: Mapped[List["InvoiceItem"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan", order_by="InvoiceItem.id"
    )
    payments: Mapped[List["Payment"]] = relationship("Payment", back_populates="invoice")  # noqa: F821


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_item_qty_positive"),
        CheckConstraint("unit_price >= 0", name="ck_item_price_nonneg"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    description: Mapped[str] = mapped_column(String(240))
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    invoice: Mapped[Invoice] = relationship(back_populates="items")
