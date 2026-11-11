"""Request schemas (pydantic v2)."""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

EMAIL = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
LANG = r"^(en|ta|hi)$"


def _blank_to_none(v):
    return None if isinstance(v, str) and not v.strip() else (v.strip() if isinstance(v, str) else v)


class RegisterIn(BaseModel):
    email: str = Field(pattern=EMAIL, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=120)


class LoginIn(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(max_length=128)


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    business_name: Optional[str] = Field(default=None, max_length=160)
    language: Optional[str] = Field(default=None, pattern=LANG)
    onboarding_completed: Optional[bool] = None


class CustomerIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: Optional[str] = Field(default=None, pattern=EMAIL, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=40)
    _clean = field_validator("email", "phone", mode="before")(_blank_to_none)


class PaymentCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=120)
    customer_email: Optional[str] = Field(default=None, pattern=EMAIL, max_length=255)
    amount: Decimal = Field(gt=0, le=Decimal("1000000"), decimal_places=2)
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    description: str = Field(min_length=1, max_length=240)
    invoice_id: Optional[int] = None
    confirm: bool = False
    idempotency_key: str = Field(min_length=8, max_length=80)
    _clean = field_validator("customer_email", "currency", mode="before")(_blank_to_none)


class ConfirmIn(BaseModel):
    confirm: bool = False
    idempotency_key: str = Field(min_length=8, max_length=80)


class ConfirmOnly(BaseModel):
    confirm: bool = False


class ActionConfirmIn(BaseModel):
    idempotency_key: Optional[str] = Field(default=None, max_length=80)


class ItemIn(BaseModel):
    description: str = Field(min_length=1, max_length=240)
    quantity: Decimal = Field(gt=0, le=Decimal("100000"))
    unit_price: Decimal = Field(ge=0, le=Decimal("1000000"), decimal_places=2)


class InvoiceCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=120)
    customer_email: Optional[str] = Field(default=None, pattern=EMAIL, max_length=255)
    items: List[ItemIn] = Field(min_length=1, max_length=50)
    tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    due_date: date
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    notes: Optional[str] = Field(default=None, max_length=2000)
    create_paypal_invoice: bool = False
    _clean = field_validator("customer_email", "currency", "notes", mode="before")(_blank_to_none)


class InvoicePatch(BaseModel):
    status: str = Field(pattern=r"^(CANCELLED|UNPAID)$")


class DuplicateCheckIn(BaseModel):
    customer_name: str = Field(min_length=1, max_length=120)
    total: Decimal = Field(ge=0)


class SuggestIn(BaseModel):
    text: str = Field(min_length=1, max_length=200)
    language: str = Field(default="en", pattern=LANG)


class SafetyCheckIn(BaseModel):
    customer_name: str = Field(min_length=1, max_length=120)
    amount: Decimal = Field(gt=0)
    currency: Optional[str] = Field(default=None, max_length=3)
    _clean = field_validator("currency", mode="before")(_blank_to_none)


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    language: str = Field(default="en", pattern=LANG)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    conversation_id: Optional[int] = None
    language: str = Field(default="en", pattern=LANG)
