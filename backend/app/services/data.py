"""Database reads that feed the pure analytics/safety modules."""
from __future__ import annotations

from sqlalchemy import func, select

from app.models import Customer, Payment, Transaction
from app.services.serializers import iso, serialize_payment


def get_data_mode(db, user_id: int, source: str = "auto", model=Payment) -> str:
    def count(flag):
        return db.scalar(select(func.count(model.id)).where(model.user_id == user_id, model.is_demo.is_(flag))) or 0

    real, demo = count(False), count(True)
    if source == "real":
        return "real" if real else "empty"
    if source == "demo":
        return "demo" if demo else "empty"
    if source == "all":
        return "mixed" if real and demo else "real" if real else "demo" if demo else "empty"
    return "real" if real else "demo" if demo else "empty"


def flags_for_mode(mode: str) -> list:
    return {"real": [False], "demo": [True], "mixed": [False, True]}.get(mode, [])


def payment_rows(db, user_id: int, mode: str) -> list:
    flags = flags_for_mode(mode)
    if not flags:
        return []
    stmt = select(Payment, Customer.name).join(Customer, Payment.customer_id == Customer.id).where(
        Payment.user_id == user_id, Payment.is_demo.in_(flags))
    return [{"id": p.id, "customer_name": name, "amount": float(p.amount), "currency": p.currency, "status": p.status,
             "description": p.description, "created_at": p.created_at, "completed_at": p.completed_at, "is_demo": p.is_demo,
             "failure_reason": p.failure_reason} for p, name in db.execute(stmt).all()]


def recent_payments(db, user_id: int, mode: str, limit: int = 6) -> list:
    flags = flags_for_mode(mode)
    if not flags:
        return []
    stmt = select(Payment).where(Payment.user_id == user_id, Payment.is_demo.in_(flags)).order_by(Payment.created_at.desc()).limit(limit)
    return [serialize_payment(p) for p in db.scalars(stmt)]


def transaction_events(db, user_id: int, mode: str, limit: int = 12) -> list:
    flags = flags_for_mode(mode)
    if not flags:
        return []
    stmt = (select(Transaction, Customer.name).join(Payment, Transaction.payment_id == Payment.id)
            .join(Customer, Payment.customer_id == Customer.id)
            .where(Transaction.user_id == user_id, Payment.is_demo.in_(flags)).order_by(Transaction.id.desc()).limit(limit))
    return [{"time": iso(t.created_at), "type": t.kind, "message": f"{name}: {t.message}"} for t, name in db.execute(stmt).all()]


def row_card(r: dict) -> dict:
    return {"id": r["id"], "customer_name": r["customer_name"], "amount": r["amount"], "currency": r["currency"], "status": r["status"],
            "description": r["description"], "is_demo": r["is_demo"], "created_at": iso(r["created_at"]), "failure_reason": r.get("failure_reason")}
