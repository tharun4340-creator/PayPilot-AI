"""Convert ORM objects into the JSON shapes documented in documentation/api-documentation.md."""
from __future__ import annotations

import json
from datetime import date


def iso(dt):
    return dt.isoformat() + "Z" if dt else None


def num(x):
    return round(float(x), 2) if x is not None else None


def serialize_user(user) -> dict:
    p = user.profile
    return {"id": user.id, "email": user.email, "full_name": user.full_name, "business_name": p.business_name if p else None,
            "language": p.language if p else "en", "onboarding_completed": bool(p and p.onboarding_completed), "created_at": iso(user.created_at)}


def serialize_customer(c, total_paid=0.0, payment_count=0) -> dict:
    return {"id": c.id, "name": c.name, "email": c.email, "phone": c.phone, "is_demo": c.is_demo, "created_at": iso(c.created_at),
            "total_paid": num(total_paid), "payment_count": int(payment_count)}


def serialize_payment(p) -> dict:
    return {"id": p.id, "customer_id": p.customer_id, "customer_name": p.customer.name if p.customer else "",
            "customer_email": p.customer.email if p.customer else None, "description": p.description, "amount": num(p.amount),
            "currency": p.currency, "status": p.status, "paypal_order_id": p.paypal_order_id, "approval_url": p.approval_url,
            "paypal_capture_id": p.paypal_capture_id, "paypal_status": p.paypal_status, "failure_reason": p.failure_reason,
            "invoice_id": p.invoice_id, "source": p.source, "is_demo": p.is_demo, "created_at": iso(p.created_at),
            "updated_at": iso(p.updated_at), "completed_at": iso(p.completed_at), "verified_at": iso(p.verified_at)}


def effective_invoice_status(inv, today: date = None) -> str:
    today = today or date.today()
    return "OVERDUE" if inv.status == "UNPAID" and inv.due_date < today else inv.status


def serialize_invoice(inv, warnings=None) -> dict:
    latest = max(inv.payments, key=lambda p: p.created_at) if inv.payments else None
    return {"id": inv.id, "number": inv.number, "customer_id": inv.customer_id, "customer_name": inv.customer.name,
            "customer_email": inv.customer.email, "status": effective_invoice_status(inv), "issue_date": inv.issue_date.isoformat(),
            "due_date": inv.due_date.isoformat(), "currency": inv.currency, "tax_rate": num(inv.tax_rate), "subtotal": num(inv.subtotal),
            "tax_amount": num(inv.tax_amount), "total": num(inv.total), "notes": inv.notes,
            "items": [{"description": i.description, "quantity": float(i.quantity), "unit_price": num(i.unit_price), "amount": num(i.amount)} for i in inv.items],
            "payment_id": latest.id if latest else None, "payment_status": latest.status if latest else None,
            "paypal_invoice_id": inv.paypal_invoice_id, "paypal_invoice_url": inv.paypal_invoice_url,
            "paypal_invoice_status": inv.paypal_invoice_status, "is_demo": inv.is_demo, "created_at": iso(inv.created_at),
            "warnings": warnings or []}


def serialize_event(t) -> dict:
    return {"time": iso(t.created_at), "type": t.kind, "message": t.message}


def serialize_pending(a) -> dict:
    return {"id": a.id, "kind": a.kind, "status": a.status, "payload": json.loads(a.payload_json),
            "preview_text": json.loads(a.payload_json).get("preview_text", ""), "warnings": json.loads(a.warnings_json or "[]"),
            "result": json.loads(a.result_json) if a.result_json else None}


def serialize_message(m, pending=None) -> dict:
    return {"id": m.id, "role": m.role, "content": m.content, "created_at": iso(m.created_at), "mode": m.mode,
            "tool_calls": json.loads(m.tool_calls_json) if m.tool_calls_json else [],
            "data": json.loads(m.data_json) if m.data_json else None,
            "pending_action": serialize_pending(pending) if pending else None}
