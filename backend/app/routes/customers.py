from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.core.deps import get_current_user
from app.core.errors import AppError
from app.database.session import get_db
from app.models import Customer, Invoice, Payment
from app.schemas.api import CustomerIn
from app.services import payments_service
from app.services.data import flags_for_mode, get_data_mode
from app.services.serializers import serialize_customer, serialize_invoice, serialize_payment

router = APIRouter(prefix="/customers", tags=["customers"])


def _totals(db, uid):
    stmt = select(Payment.customer_id, func.count(Payment.id), func.coalesce(func.sum(Payment.amount), 0)).where(
        Payment.user_id == uid, Payment.status == "COMPLETED").group_by(Payment.customer_id)
    return {cid: (float(total), n) for cid, n, total in db.execute(stmt).all()}


@router.get("")
def list_customers(source: str = Query("auto", pattern="^(auto|real|demo|all)$"), user=Depends(get_current_user), db=Depends(get_db)):
    mode = get_data_mode(db, user.id, source, Customer)
    flags = flags_for_mode(mode)
    if not flags:
        return []
    totals = _totals(db, user.id)
    rows = db.scalars(select(Customer).where(Customer.user_id == user.id, Customer.is_demo.in_(flags)).order_by(Customer.name))
    return [serialize_customer(c, *totals.get(c.id, (0.0, 0))) for c in rows]


@router.post("", status_code=201)
def create_customer(body: CustomerIn, user=Depends(get_current_user), db=Depends(get_db)):
    c = payments_service.get_or_create_customer(db, user.id, body.name, body.email)
    if body.phone:
        c.phone = body.phone
    db.commit()
    return serialize_customer(c)


@router.get("/{customer_id}")
def customer_detail(customer_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    c = db.get(Customer, customer_id)
    if not c or c.user_id != user.id:
        raise AppError(404, "Customer not found.")
    pays = list(db.scalars(select(Payment).where(Payment.customer_id == c.id, Payment.user_id == user.id).order_by(Payment.created_at.desc())))
    invs = list(db.scalars(select(Invoice).where(Invoice.customer_id == c.id, Invoice.user_id == user.id).order_by(Invoice.created_at.desc())))
    paid = sum(float(p.amount) for p in pays if p.status == "COMPLETED")
    return {"customer": serialize_customer(c, paid, sum(1 for p in pays if p.status == "COMPLETED")), "payments": [serialize_payment(p) for p in pays],
            "invoices": [serialize_invoice(i) for i in invs],
            "totals": {"paid": round(paid, 2), "pending": round(sum(float(p.amount) for p in pays if p.status in ("CREATED", "APPROVED")), 2), "count": len(pays)}}
