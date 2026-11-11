from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select

from app.core.config import get_settings
from app.core.deps import get_current_user, get_paypal, rate_limit
from app.core.errors import AppError
from app.database.session import get_db
from app.models import Customer, Payment
from app.schemas.api import ConfirmIn, PaymentCreate
from app.services import analytics, invoices_service, payments_service, safety
from app.services.data import flags_for_mode, get_data_mode, payment_rows
from app.services.serializers import serialize_event, serialize_payment
from app.models.base import utcnow

router = APIRouter(prefix="/payments", tags=["payments"])
GROUPS = {"pending": ("CREATED", "APPROVED"), "completed": ("COMPLETED",), "failed": ("FAILED", "CANCELLED")}


@router.get("")
def list_payments(status: str = Query("all", pattern="^(all|pending|completed|failed)$"), q: Optional[str] = Query(None, max_length=100),
                  source: str = Query("auto", pattern="^(auto|real|demo|all)$"), limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
                  user=Depends(get_current_user), db=Depends(get_db)):
    flags = flags_for_mode(get_data_mode(db, user.id, source))
    if not flags:
        return {"items": [], "total": 0}
    stmt = select(Payment).join(Customer, Payment.customer_id == Customer.id).where(Payment.user_id == user.id, Payment.is_demo.in_(flags))
    if status in GROUPS:
        stmt = stmt.where(Payment.status.in_(GROUPS[status]))
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(or_(func.lower(Customer.name).like(like), func.lower(Payment.description).like(like), func.lower(func.coalesce(Payment.paypal_order_id, "")).like(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Payment.created_at.desc()).limit(limit).offset(offset))
    return {"items": [serialize_payment(p) for p in rows], "total": total}


@router.post("", status_code=201, dependencies=[Depends(rate_limit("payment-create", 20))])
def create_payment(body: PaymentCreate, user=Depends(get_current_user), db=Depends(get_db), settings=Depends(get_settings), paypal=Depends(get_paypal)):
    if not body.confirm:
        raise AppError(400, "Please confirm the payment request before it is created.")
    invoice = invoices_service.get_owned_invoice(db, user.id, body.invoice_id) if body.invoice_id else None
    payment, warnings = payments_service.create_payment(db, user, settings, paypal, customer_name=body.customer_name, customer_email=body.customer_email,
                                                        amount=body.amount, currency=body.currency, description=body.description,
                                                        idempotency_key=body.idempotency_key, invoice=invoice, source="invoice" if invoice else "manual")
    return {**serialize_payment(payment), "warnings": warnings}


@router.get("/by-order/{paypal_order_id}")
def by_order(paypal_order_id: str, user=Depends(get_current_user), db=Depends(get_db), paypal=Depends(get_paypal)):
    payment = db.scalar(select(Payment).where(Payment.paypal_order_id == paypal_order_id, Payment.user_id == user.id))
    if not payment:
        raise AppError(404, "We couldn't find a payment for this PayPal order.")
    if paypal is not None:
        payments_service.verify_payment(db, user, payment, paypal)
    return serialize_payment(payment)


@router.get("/{payment_id}")
def payment_detail(payment_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    p = payments_service.get_owned_payment(db, user.id, payment_id)
    rows = payment_rows(db, user.id, "demo" if p.is_demo else "real")
    warns = [f"{a['title']}: {a['explanation']}" for a in safety.detect_alerts(rows, utcnow()) if p.id in a["payment_ids"]]
    return {"payment": serialize_payment(p), "events": [serialize_event(e) for e in p.events], "safety_warnings": warns}


@router.post("/{payment_id}/verify", dependencies=[Depends(rate_limit("payment-verify", 30))])
def verify(payment_id: int, user=Depends(get_current_user), db=Depends(get_db), paypal=Depends(get_paypal)):
    p = payments_service.get_owned_payment(db, user.id, payment_id)
    return serialize_payment(payments_service.verify_payment(db, user, p, paypal))


@router.post("/{payment_id}/capture", dependencies=[Depends(rate_limit("payment-capture", 20))])
def capture(payment_id: int, body: ConfirmIn, user=Depends(get_current_user), db=Depends(get_db), paypal=Depends(get_paypal)):
    if not body.confirm:
        raise AppError(400, "Please confirm before capturing this payment.")
    p = payments_service.get_owned_payment(db, user.id, payment_id)
    return serialize_payment(payments_service.capture_payment(db, user, p, paypal, body.idempotency_key))
