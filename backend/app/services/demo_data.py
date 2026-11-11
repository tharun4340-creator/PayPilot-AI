"""Sample data, always flagged is_demo=True so it can never be mistaken for real PayPal transactions."""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import delete, func, select

from app.models import Customer, Invoice, InvoiceItem, Payment, Transaction
from app.models.base import utcnow

CUSTOMERS = [("Rahul Sharma", "rahul@example.com"), ("Priya Nair", "priya@example.com"), ("Arjun Menon", "arjun@example.com"),
             ("Meera Iyer", "meera@example.com"), ("Karthik Raj", "karthik@example.com"), ("Northwind Traders (sample)", "orders@example.com")]
# (customer index, amount, status, days ago, description, failure reason)
PAYMENTS = [(0, 450, "COMPLETED", 150, "Website design", None), (1, 320, "COMPLETED", 128, "Logo design", None), (2, 780, "COMPLETED", 110, "Mobile app development", None),
            (0, 450, "COMPLETED", 92, "Monthly retainer", None), (3, 260, "COMPLETED", 75, "Content writing", None), (1, 540, "COMPLETED", 60, "Brand identity", None),
            (4, 300, "COMPLETED", 48, "SEO consulting session", None), (0, 450, "COMPLETED", 33, "Monthly retainer", None), (2, 620, "COMPLETED", 21, "Website maintenance", None),
            (3, 320, "COMPLETED", 3, "Blog articles", None), (3, 320, "CREATED", 2, "Blog articles", None), (4, 410, "CREATED", 12, "Social media campaign", None),
            (1, 280, "FAILED", 9, "Poster design", "Capture declined: INSTRUMENT_DECLINED"), (2, 150, "CANCELLED", 5, "Hosting setup", "The order was voided or expired on PayPal."),
            (5, 5400, "COMPLETED", 1, "Bulk product order", None)]


def has_demo(db, user_id: int) -> bool:
    return bool(db.scalar(select(func.count(Payment.id)).where(Payment.user_id == user_id, Payment.is_demo.is_(True))))


def seed(db, user, currency: str) -> dict:
    if has_demo(db, user.id):
        return {"customers": 0, "invoices": 0, "payments": 0}
    now, custs = utcnow(), []
    for name, email in CUSTOMERS:
        c = Customer(user_id=user.id, name=name, email=email, is_demo=True)
        db.add(c)
        custs.append(c)
    db.flush()
    for idx, amount, status, days, desc, reason in PAYMENTS:
        when = now - timedelta(days=days)
        p = Payment(user_id=user.id, customer_id=custs[idx].id, description=desc, amount=amount, currency=currency, status=status, source="manual",
                    is_demo=True, failure_reason=reason, created_at=when, updated_at=when, completed_at=when if status == "COMPLETED" else None)
        db.add(p)
        db.flush()
        msg = {"COMPLETED": "Sample payment marked completed (DEMO DATA).", "CREATED": "Sample payment waiting for approval (DEMO DATA).",
               "FAILED": reason, "CANCELLED": reason}[status]
        db.add(Transaction(user_id=user.id, payment_id=p.id, kind=f"demo_{status.lower()}", message=msg, created_at=when))
    inv_specs = [(0, 450, "PAID", -30), (1, 540, "UNPAID", 10), (4, 300, "UNPAID", -6), (3, 260, "CANCELLED", -20), (2, 620, "PAID", -15)]
    for n, (idx, total, status, due_in) in enumerate(inv_specs, start=1):
        inv = Invoice(user_id=user.id, customer_id=custs[idx].id, number=f"DEMO-{n:04d}", status=status, issue_date=date.today() - timedelta(days=30),
                      due_date=date.today() + timedelta(days=due_in), currency=currency, tax_rate=0, subtotal=total, tax_amount=0, total=total, is_demo=True)
        inv.items = [InvoiceItem(description="Sample service (DEMO DATA)", quantity=1, unit_price=total, amount=total)]
        db.add(inv)
    db.commit()
    return {"customers": len(CUSTOMERS), "invoices": len(inv_specs), "payments": len(PAYMENTS)}


def remove(db, user) -> int:
    uid, removed = user.id, 0
    pay_ids = [i for i in db.scalars(select(Payment.id).where(Payment.user_id == uid, Payment.is_demo.is_(True)))]
    if pay_ids:
        db.execute(delete(Transaction).where(Transaction.payment_id.in_(pay_ids)))
        db.execute(delete(Payment).where(Payment.id.in_(pay_ids)))
        removed += len(pay_ids)
    inv_ids = [i for i in db.scalars(select(Invoice.id).where(Invoice.user_id == uid, Invoice.is_demo.is_(True)))]
    if inv_ids:
        db.execute(delete(InvoiceItem).where(InvoiceItem.invoice_id.in_(inv_ids)))
        db.execute(delete(Invoice).where(Invoice.id.in_(inv_ids)))
        removed += len(inv_ids)
    # customers flagged demo, plus any customer left with no payments/invoices that only demo data used
    for c in db.scalars(select(Customer).where(Customer.user_id == uid, Customer.is_demo.is_(True))):
        in_use = db.scalar(select(func.count(Payment.id)).where(Payment.customer_id == c.id)) or db.scalar(select(func.count(Invoice.id)).where(Invoice.customer_id == c.id))
        if not in_use:
            db.delete(c)
            removed += 1
    db.commit()
    return removed
