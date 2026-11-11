"""Payment workflow. PayPal is the source of truth: a payment is only COMPLETED after we read it back from PayPal."""
from __future__ import annotations

import logging
from decimal import Decimal

from sqlalchemy import func, select

from app.core.errors import AppError
from app.models import Customer, Payment, Transaction
from app.models.base import utcnow
from app.services import safety
from app.services.audit import log_action, notify
from app.services.data import payment_rows
from app.services.paypal_client import PayPalError, approval_url_from, map_order_status

log = logging.getLogger("paypilot.payments")
MAX_AMOUNT = Decimal("1000000")


def add_event(db, payment, kind: str, message: str, raw_status: str = None) -> None:
    db.add(Transaction(user_id=payment.user_id, payment_id=payment.id, kind=kind, message=message, raw_status=raw_status))


def get_or_create_customer(db, user_id: int, name: str, email: str = None, is_demo: bool = False) -> Customer:
    name = name.strip()
    existing = db.scalar(select(Customer).where(Customer.user_id == user_id, func.lower(Customer.name) == name.lower(), Customer.is_demo == is_demo))
    if existing:
        if email and not existing.email:
            existing.email = email
        return existing
    c = Customer(user_id=user_id, name=name, email=email, is_demo=is_demo)
    db.add(c)
    db.flush()
    return c


def get_owned_payment(db, user_id: int, payment_id: int) -> Payment:
    p = db.get(Payment, payment_id)
    if not p or p.user_id != user_id:  # 404 (not 403) so other users' ids are not revealed
        raise AppError(404, "Payment not found.")
    return p


def _paypal_call(fn, currency=None):
    try:
        return fn()
    except PayPalError as exc:
        log.warning("PayPal error status=%s issue=%s debug=%s", exc.status, exc.issue, exc.debug_id)
        raise AppError(502 if exc.status in (0, 429) or exc.status >= 500 else 400, exc.friendly(currency)) from exc


def check_warnings(db, user, customer_name, amount, currency, is_demo) -> list:
    mode = "demo" if is_demo else "real"
    return safety.check_new_payment(payment_rows(db, user.id, mode), customer_name, float(amount), currency, utcnow())


def create_payment(db, user, settings, paypal, *, customer_name, customer_email, amount, currency, description,
                   idempotency_key, invoice=None, source="manual"):
    existing = db.scalar(select(Payment).where(Payment.user_id == user.id, Payment.idempotency_key == idempotency_key))
    if existing:
        return existing, []
    amount = Decimal(str(amount))
    if amount <= 0 or amount > MAX_AMOUNT:
        raise AppError(400, "Please enter an amount above zero (and no more than 1,000,000).")
    currency = (currency or (invoice.currency if invoice else None) or settings.paypal_default_currency).upper()
    is_demo = paypal is None
    warnings = [f"{w['title']}: {w['explanation']}" for w in check_warnings(db, user, customer_name, amount, currency, is_demo)]
    customer = get_or_create_customer(db, user.id, customer_name, customer_email, is_demo=False if invoice is None else invoice.customer.is_demo)
    payment = Payment(user_id=user.id, customer_id=customer.id, invoice_id=invoice.id if invoice else None, description=description.strip(),
                      amount=amount, currency=currency, status="CREATED", source=source, is_demo=is_demo, idempotency_key=idempotency_key)
    db.add(payment)
    db.flush()
    if paypal is None:
        add_event(db, payment, "demo_created", "Demo mode: PayPal is not connected, so no real payment was started.")
        log_action(db, user.id, "payment.demo_created", f"payment {payment.id}")
        db.commit()
        return payment, warnings
    try:
        order = paypal.create_order(amount, currency, description, f"PP-{payment.id}", f"{settings.frontend_url}/payments/return",
                                    f"{settings.frontend_url}/payments/cancelled", request_id=f"order-{user.id}-{idempotency_key}")
    except PayPalError as exc:
        payment.status, payment.failure_reason = "FAILED", exc.friendly(currency)
        add_event(db, payment, "order_failed", payment.failure_reason)
        log_action(db, user.id, "payment.create_failed", f"payment {payment.id}: {exc.issue or exc.status}")
        db.commit()
        raise AppError(400 if 400 <= exc.status < 500 else 502, payment.failure_reason) from exc
    payment.paypal_order_id = order["id"]
    payment.approval_url = approval_url_from(order)
    payment.paypal_status = order.get("status")
    add_event(db, payment, "order_created", "PayPal order created. Waiting for the customer to approve.", order.get("status"))
    log_action(db, user.id, "payment.created", f"payment {payment.id} order {order['id']} {amount} {currency}")
    db.commit()
    return payment, warnings


def apply_order(db, payment, order: dict, source: str = "verify") -> Payment:
    result = map_order_status(order, payment.amount, payment.currency)
    payment.verified_at = utcnow()
    payment.paypal_status = order.get("status")
    if payment.status == "COMPLETED":  # never downgrade a verified completion
        return payment
    old = payment.status
    payment.status, payment.failure_reason = result.status, result.failure_reason
    if result.capture_id:
        payment.paypal_capture_id = result.capture_id
    if result.status == "COMPLETED":
        payment.completed_at = utcnow()
        if payment.invoice and payment.invoice.status != "CANCELLED":
            payment.invoice.status = "PAID"
        notify(db, payment.user_id, "Payment received", f"Payment #{payment.id} was confirmed by PayPal.", "success")
    if result.mismatch:
        notify(db, payment.user_id, "Payment amount mismatch", f"PayPal reported a different amount for payment #{payment.id}. It was NOT marked as paid.", "warning")
    if result.status != old or source == "verify":
        add_event(db, payment, f"{source}_{result.status.lower()}", result.message, order.get("status"))
    return payment


def verify_payment(db, user, payment, paypal) -> Payment:
    if payment.is_demo or not payment.paypal_order_id or paypal is None:
        raise AppError(400, "This is a demo record, so there is nothing to verify with PayPal.")
    order = _paypal_call(lambda: paypal.get_order(payment.paypal_order_id), payment.currency)
    apply_order(db, payment, order)
    log_action(db, user.id, "payment.verified", f"payment {payment.id} -> {payment.status}")
    db.commit()
    return payment


def capture_payment(db, user, payment, paypal, idempotency_key: str) -> Payment:
    if payment.is_demo or not payment.paypal_order_id or paypal is None:
        raise AppError(400, "Demo records cannot be captured. Connect PayPal Sandbox to take real test payments.")
    if payment.status == "COMPLETED":
        return payment
    order = _paypal_call(lambda: paypal.get_order(payment.paypal_order_id), payment.currency)
    if order.get("status") == "COMPLETED":
        apply_order(db, payment, order)
        db.commit()
        return payment
    if order.get("status") != "APPROVED":
        raise AppError(409, "The customer has not approved this payment on PayPal yet.")
    try:
        paypal.capture_order(payment.paypal_order_id, request_id=f"capture-{payment.id}-{idempotency_key}")
    except PayPalError as exc:
        payment.failure_reason = exc.friendly(payment.currency)
        add_event(db, payment, "capture_failed", payment.failure_reason)
        log_action(db, user.id, "payment.capture_failed", f"payment {payment.id}: {exc.issue or exc.status}")
        db.commit()
        raise AppError(422 if exc.status == 422 else 502, payment.failure_reason) from exc
    fresh = _paypal_call(lambda: paypal.get_order(payment.paypal_order_id), payment.currency)  # re-verify, don't trust the capture reply
    apply_order(db, payment, fresh, source="capture")
    log_action(db, user.id, "payment.captured", f"payment {payment.id} -> {payment.status}")
    db.commit()
    return payment


def sync_from_paypal(db, payment, paypal, source: str = "webhook") -> None:
    order = paypal.get_order(payment.paypal_order_id)
    apply_order(db, payment, order, source=source)
