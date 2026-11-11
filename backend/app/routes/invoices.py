from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import func, or_, select

from app.core.config import get_settings
from app.core.deps import get_current_user, get_llm, get_paypal, rate_limit
from app.core.errors import AppError
from app.database.session import get_db
from app.models import Customer, Invoice
from app.schemas.api import ConfirmIn, ConfirmOnly, DuplicateCheckIn, InvoiceCreate, InvoicePatch, SuggestIn
from app.services import invoices_service
from app.services.data import flags_for_mode, get_data_mode
from app.services.i18n import LANGUAGE_NAMES
from app.services.invoice_pdf import render_invoice_pdf
from app.services.llm import LLMError
from app.services.serializers import effective_invoice_status, serialize_invoice, serialize_payment

router = APIRouter(prefix="/invoices", tags=["invoices"])


@router.get("")
def list_invoices(status: str = Query("all", pattern="^(all|DRAFT|UNPAID|PAID|OVERDUE|CANCELLED)$"), q: Optional[str] = Query(None, max_length=100),
                  source: str = Query("auto", pattern="^(auto|real|demo|all)$"), user=Depends(get_current_user), db=Depends(get_db)):
    flags = flags_for_mode(get_data_mode(db, user.id, source, Invoice))
    if not flags:
        return []
    stmt = select(Invoice).join(Customer, Invoice.customer_id == Customer.id).where(Invoice.user_id == user.id, Invoice.is_demo.in_(flags))
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(or_(func.lower(Customer.name).like(like), func.lower(Invoice.number).like(like)))
    items = [serialize_invoice(i) for i in db.scalars(stmt.order_by(Invoice.created_at.desc()).limit(200))]
    return [i for i in items if status == "all" or i["status"] == status]


@router.post("", status_code=201)
def create_invoice(body: InvoiceCreate, user=Depends(get_current_user), db=Depends(get_db), settings=Depends(get_settings), paypal=Depends(get_paypal)):
    inv, warnings = invoices_service.create_invoice(
        db, user, settings, paypal, customer_name=body.customer_name, customer_email=body.customer_email,
        items=[i.model_dump() for i in body.items], tax_rate=body.tax_rate, due_date=body.due_date, currency=body.currency,
        notes=body.notes, create_paypal_invoice=body.create_paypal_invoice)
    return serialize_invoice(inv, warnings)


@router.post("/check-duplicate")
def check_duplicate(body: DuplicateCheckIn, user=Depends(get_current_user), db=Depends(get_db)):
    return {"duplicates": [serialize_invoice(i) for i in invoices_service.find_duplicates(db, user.id, body.customer_name, body.total)]}


@router.post("/suggest-description")
def suggest(body: SuggestIn, user=Depends(get_current_user), llm=Depends(get_llm), _=Depends(rate_limit("suggest", 20))):
    text = body.text.strip()
    if llm is not None:
        try:
            out = llm.complete(f"Suggest 3 short, professional invoice line-item descriptions in {LANGUAGE_NAMES[body.language]}. One per line, no numbering, no prices.", text)
            lines = [l.strip(" -•\t") for l in out.splitlines() if l.strip()][:3]
            if lines:
                return {"suggestions": lines, "generated_by": "llm"}
        except LLMError:
            pass
    base = text[:80]
    return {"suggestions": [f"{base} - professional services", f"{base} (as discussed)", f"{base} - project work, including revisions"], "generated_by": "rule-based"}


@router.get("/{invoice_id}")
def get_invoice(invoice_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    return serialize_invoice(invoices_service.get_owned_invoice(db, user.id, invoice_id))


@router.patch("/{invoice_id}")
def patch_invoice(invoice_id: int, body: InvoicePatch, user=Depends(get_current_user), db=Depends(get_db)):
    inv = invoices_service.get_owned_invoice(db, user.id, invoice_id)
    return serialize_invoice(invoices_service.set_status(db, user, inv, body.status))


@router.get("/{invoice_id}/pdf")
def pdf(invoice_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    inv = invoices_service.get_owned_invoice(db, user.id, invoice_id)
    seller = {"name": (user.profile.business_name if user.profile and user.profile.business_name else user.full_name), "email": user.email}
    data = render_invoice_pdf(serialize_invoice(inv), seller)
    return Response(data, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{inv.number}.pdf"'})


@router.post("/{invoice_id}/pay", dependencies=[Depends(rate_limit("invoice-pay", 20))])
def pay(invoice_id: int, body: ConfirmIn, user=Depends(get_current_user), db=Depends(get_db), settings=Depends(get_settings), paypal=Depends(get_paypal)):
    if not body.confirm:
        raise AppError(400, "Please confirm before creating the payment.")
    inv = invoices_service.get_owned_invoice(db, user.id, invoice_id)
    return serialize_payment(invoices_service.pay_invoice(db, user, settings, paypal, inv, body.idempotency_key))


@router.post("/{invoice_id}/send")
def send(invoice_id: int, body: ConfirmOnly, user=Depends(get_current_user), db=Depends(get_db), paypal=Depends(get_paypal)):
    if not body.confirm:
        raise AppError(400, "Please confirm before sending the invoice.")
    inv = invoices_service.get_owned_invoice(db, user.id, invoice_id)
    return serialize_invoice(invoices_service.send_paypal_invoice(db, user, paypal, inv))
