from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select

from app.core.errors import AppError
from app.models import Customer, Invoice, InvoiceItem, Notification
from app.models.base import utcnow
from app.services import i18n, payments_service
from app.services.audit import log_action, notify
from app.services.money import calc_totals, format_money
from app.services.paypal_client import PayPalError
from app.services.serializers import effective_invoice_status


def get_owned_invoice(db, user_id: int, invoice_id: int) -> Invoice:
    inv = db.get(Invoice, invoice_id)
    if not inv or inv.user_id != user_id:
        raise AppError(404, "Invoice not found.")
    return inv


def next_number(db, user_id: int) -> str:
    year = date.today().year
    n = (db.scalar(select(func.count(Invoice.id)).where(Invoice.user_id == user_id, Invoice.number.like(f"INV-{year}-%"))) or 0) + 1
    while db.scalar(select(Invoice.id).where(Invoice.user_id == user_id, Invoice.number == f"INV-{year}-{n:04d}")):
        n += 1
    return f"INV-{year}-{n:04d}"


def find_duplicates(db, user_id: int, customer_name: str, total) -> list:
    cutoff = utcnow() - timedelta(days=30)
    stmt = (select(Invoice).join(Customer, Invoice.customer_id == Customer.id)
            .where(Invoice.user_id == user_id, func.lower(Customer.name) == customer_name.strip().lower(), Invoice.total == Decimal(str(total)),
                   Invoice.status != "CANCELLED", Invoice.created_at >= cutoff))
    return list(db.scalars(stmt))


def create_invoice(db, user, settings, paypal, *, customer_name, customer_email, items, tax_rate, due_date, currency, notes=None,
                   create_paypal_invoice=False, is_demo=False):
    try:
        calc = calc_totals([{"description": i["description"], "quantity": i["quantity"], "unit_price": i["unit_price"]} for i in items], tax_rate)
    except ValueError as exc:
        raise AppError(400, str(exc)) from exc
    if due_date < date.today() - timedelta(days=1):
        raise AppError(400, "The due date cannot be in the past.")
    currency = (currency or settings.paypal_default_currency).upper()
    warnings = [f"A similar invoice ({d.number}) for {customer_name} with the same total was created recently. Check you are not billing twice."
                for d in find_duplicates(db, user.id, customer_name, calc["total"])]
    customer = payments_service.get_or_create_customer(db, user.id, customer_name, customer_email, is_demo=is_demo)
    inv = Invoice(user_id=user.id, customer_id=customer.id, number=next_number(db, user.id), status="UNPAID", issue_date=date.today(), due_date=due_date,
                  currency=currency, tax_rate=calc["tax_rate"], subtotal=calc["subtotal"], tax_amount=calc["tax_amount"], total=calc["total"],
                  notes=notes, is_demo=is_demo)
    inv.items = [InvoiceItem(description=r["description"], quantity=r["quantity"], unit_price=r["unit_price"], amount=r["amount"]) for r in calc["items"]]
    db.add(inv)
    db.flush()
    if create_paypal_invoice:
        if paypal is None:
            warnings.append("PayPal Invoicing is not available because PayPal is not connected, so a local invoice was created instead.")
        else:
            try:
                res = paypal.create_draft_invoice(inv.number, currency, inv.issue_date.isoformat(), due_date.isoformat(), customer_name, customer.email,
                                                  calc["items"], calc["tax_rate"], notes)
                inv.paypal_invoice_id, inv.paypal_invoice_status, inv.status = res["id"], "DRAFT", "DRAFT"
            except PayPalError as exc:
                warnings.append(f"PayPal Invoicing could not create a draft ({exc.friendly(currency)}) so a local invoice was created instead.")
    log_action(db, user.id, "invoice.created", f"{inv.number} total {calc['total']} {currency}")
    db.commit()
    return inv, warnings


def pay_invoice(db, user, settings, paypal, inv, idempotency_key: str):
    if inv.status in ("PAID", "CANCELLED"):
        raise AppError(409, f"This invoice is already {inv.status.lower()}.")
    payment, _ = payments_service.create_payment(db, user, settings, paypal, customer_name=inv.customer.name, customer_email=inv.customer.email,
                                                 amount=inv.total, currency=inv.currency, description=f"Invoice {inv.number}",
                                                 idempotency_key=idempotency_key, invoice=inv, source="invoice")
    return payment


def set_status(db, user, inv, status: str):
    if inv.status == "PAID":
        raise AppError(409, "A paid invoice cannot be changed.")
    inv.status = status
    log_action(db, user.id, "invoice.status", f"{inv.number} -> {status}")
    db.commit()
    return inv


def send_paypal_invoice(db, user, paypal, inv):
    if not inv.paypal_invoice_id or paypal is None:
        raise AppError(400, "This invoice has no PayPal draft to send.")
    try:
        paypal.send_invoice(inv.paypal_invoice_id)
    except PayPalError as exc:
        raise AppError(400, exc.friendly(inv.currency)) from exc
    inv.status, inv.paypal_invoice_status = "UNPAID", "SENT"
    log_action(db, user.id, "invoice.sent", inv.number)
    db.commit()
    return inv


def build_reminders(db, user_id: int, lang: str = "en") -> list:
    today, out = date.today(), []
    stmt = select(Invoice).where(Invoice.user_id == user_id, Invoice.status == "UNPAID", Invoice.is_demo.is_(False))
    for inv in db.scalars(stmt):
        delta = (today - inv.due_date).days
        if delta >= 0 or -delta <= 3:
            amount = format_money(inv.total, inv.currency)
            msg = (i18n.t(lang, "reminder_overdue", number=inv.number, customer=inv.customer.name, days=delta, amount=amount) if delta >= 0
                   else i18n.t(lang, "reminder_due_soon", number=inv.number, customer=inv.customer.name, days=-delta, amount=amount))
            out.append({"invoice_id": inv.id, "number": inv.number, "customer_name": inv.customer.name, "days_overdue": max(delta, 0), "message": msg})
    return out


def generate_reminder_notifications(db, user, lang: str = "en") -> dict:
    items, created = build_reminders(db, user.id, lang), 0
    for it in items:
        title = f"Reminder: {it['number']}"
        if db.scalar(select(Notification.id).where(Notification.user_id == user.id, Notification.title == title, Notification.read.is_(False))):
            continue
        notify(db, user.id, title, it["message"], "warning" if it["days_overdue"] else "info")
        created += 1
    db.commit()
    return {"created": created, "items": items}
