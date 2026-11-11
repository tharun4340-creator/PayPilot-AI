"""Tools the AI may call. Read tools return data; prepare_* tools only save a DRAFT (PendingAction). Nothing here moves money."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Optional

from sqlalchemy import select

from app.models import Payment, PendingAction
from app.models.base import utcnow
from app.services import analytics, payments_service, troubleshooting
from app.services.data import get_data_mode, payment_rows, row_card
from app.services.money import format_money, to_decimal

STATUS_GROUPS = {"pending": analytics.PENDING, "completed": ("COMPLETED",), "failed": analytics.FAILED}

TOOL_SCHEMAS = [
    {"name": "list_recent_payments", "description": "List the user's recent payments, optionally filtered by status group or a search text.",
     "input_schema": {"type": "object", "properties": {"limit": {"type": "integer"}, "status": {"type": "string", "enum": ["all", "pending", "completed", "failed"]},
                                                      "query": {"type": "string"}}}},
    {"name": "find_pending_payments", "description": "List payments still waiting for approval or capture.", "input_schema": {"type": "object", "properties": {}}},
    {"name": "summarize_transactions", "description": "Totals for a month (default current month). month format YYYY-MM.",
     "input_schema": {"type": "object", "properties": {"month": {"type": "string"}}}},
    {"name": "get_top_customers", "description": "Top customers by completed payment total.", "input_schema": {"type": "object", "properties": {"limit": {"type": "integer"}}}},
    {"name": "generate_monthly_report", "description": "Monthly business report with totals, top customers and categories.",
     "input_schema": {"type": "object", "properties": {"month": {"type": "string"}}}},
    {"name": "explain_payment_failure", "description": "Explain why a payment failed (latest failed one if payment_id is omitted).",
     "input_schema": {"type": "object", "properties": {"payment_id": {"type": "integer"}}}},
    {"name": "prepare_payment_request", "description": "Prepare (NOT send) a payment request draft for the user to confirm. Requires customer name, amount and what it is for.",
     "input_schema": {"type": "object", "required": ["customer_name", "amount", "description"],
                      "properties": {"customer_name": {"type": "string"}, "amount": {"type": "number"}, "currency": {"type": "string"}, "description": {"type": "string"}}}},
    {"name": "prepare_invoice", "description": "Prepare (NOT create) an invoice draft for the user to confirm.",
     "input_schema": {"type": "object", "required": ["customer_name", "amount", "description"],
                      "properties": {"customer_name": {"type": "string"}, "customer_email": {"type": "string"}, "amount": {"type": "number", "description": "unit price"},
                                     "quantity": {"type": "number"}, "description": {"type": "string"}, "tax_rate": {"type": "number"},
                                     "due_in_days": {"type": "integer"}, "currency": {"type": "string"}}}},
]


@dataclass
class ToolResult:
    content: dict
    summary: str
    data: Optional[dict] = None
    pending: Optional[PendingAction] = None


class ToolExecutor:
    def __init__(self, db, user, settings, conversation_id: Optional[int] = None):
        self.db, self.user, self.settings, self.conversation_id = db, user, settings, conversation_id

    def run(self, name: str, args: dict) -> ToolResult:
        fn = getattr(self, f"_t_{name}", None) if name in {t["name"] for t in TOOL_SCHEMAS} else None
        if fn is None:
            return ToolResult({"error": f"Unknown tool {name}"}, "unknown tool")
        try:
            return fn(**{k: v for k, v in (args or {}).items() if v is not None})
        except (ValueError, TypeError) as exc:
            return ToolResult({"error": str(exc)}, "invalid input")

    # ---- helpers
    def _rows(self):
        mode = get_data_mode(self.db, self.user.id, "auto")
        return mode, payment_rows(self.db, self.user.id, mode)

    def _cur(self, rows):
        return analytics.primary_currency(rows, self.settings.paypal_default_currency)

    def _month(self, month):
        return month if month and len(month) == 7 else analytics.month_key(utcnow())

    # ---- read tools
    def _list(self, status="all", limit=5, query=None, summary="payments"):
        mode, rows = self._rows()
        limit = max(1, min(int(limit), 20))
        if status in STATUS_GROUPS:
            rows = [r for r in rows if r["status"] in STATUS_GROUPS[status]]
        if query:
            q = str(query).lower()
            rows = [r for r in rows if q in r["customer_name"].lower() or q in r["description"].lower()]
        rows = sorted(rows, key=lambda r: r["created_at"], reverse=True)
        picked = [row_card(r) for r in rows[:limit]]
        total = round(sum(r["amount"] for r in rows), 2)
        return ToolResult({"data_mode": mode, "is_demo_data": mode == "demo", "count": len(rows), "total_amount": total, "payments": picked},
                          f"{len(rows)} payments", {"type": "payments", "data_mode": mode, "items": picked, "total_amount": total, "count": len(rows)})

    def _t_list_recent_payments(self, limit=5, status="all", query=None):
        return self._list(status, limit, query)

    def _t_find_pending_payments(self):
        return self._list("pending", 20)

    def _t_summarize_transactions(self, month=None):
        mode, rows = self._rows()
        rep = analytics.monthly_report(rows, self._month(month), self._cur(rows))
        return ToolResult({"data_mode": mode, "is_demo_data": mode == "demo", "month": rep["month"], "totals": rep["totals"]}, f"summary {rep['month']}",
                          {"type": "summary", "data_mode": mode, "month": rep["month"], "totals": rep["totals"]})

    def _t_get_top_customers(self, limit=5):
        mode, rows = self._rows()
        cur = self._cur(rows)
        tops = analytics.top_customers(rows, cur, max(1, min(int(limit), 10)))
        return ToolResult({"data_mode": mode, "is_demo_data": mode == "demo", "currency": cur, "top_customers": tops}, f"{len(tops)} customers",
                          {"type": "customers", "data_mode": mode, "currency": cur, "items": tops})

    def _t_generate_monthly_report(self, month=None):
        mode, rows = self._rows()
        rep = analytics.monthly_report(rows, self._month(month), self._cur(rows))
        return ToolResult({"data_mode": mode, "is_demo_data": mode == "demo", **rep}, f"report {rep['month']}",
                          {"type": "report", "data_mode": mode, "month": rep["month"], "text": rep["text"], "totals": rep["totals"]})

    def _t_explain_payment_failure(self, payment_id=None):
        stmt = select(Payment).where(Payment.user_id == self.user.id, Payment.status.in_(analytics.FAILED))
        if payment_id:
            stmt = stmt.where(Payment.id == int(payment_id))
        p = self.db.scalars(stmt.order_by(Payment.created_at.desc())).first()
        if not p:
            return ToolResult({"found": False}, "no failed payment")
        events = [e.message for e in p.events][-5:]
        hints = troubleshooting.hints_for(p.failure_reason or "")
        card = {**row_card({"id": p.id, "customer_name": p.customer.name, "amount": float(p.amount), "currency": p.currency, "status": p.status,
                            "description": p.description, "is_demo": p.is_demo, "created_at": p.created_at, "failure_reason": p.failure_reason})}
        return ToolResult({"found": True, "payment": card, "failure_reason": p.failure_reason, "paypal_status": p.paypal_status, "history": events, "suggestions": hints},
                          f"payment #{p.id}", {"type": "payments", "data_mode": "demo" if p.is_demo else "real", "items": [card], "hints": hints})

    # ---- prepare tools (drafts only)
    def _draft(self, kind, payload, warnings, preview):
        payload["preview_text"] = preview
        action = PendingAction(user_id=self.user.id, conversation_id=self.conversation_id, kind=kind, payload_json=json.dumps(payload, default=str),
                               warnings_json=json.dumps(warnings))
        self.db.add(action)
        self.db.flush()
        return ToolResult({"status": "pending_user_confirmation", "action_id": action.id, "preview": preview, "warnings": warnings,
                           "note": "Draft saved. NOTHING has been sent to PayPal. The user must press Confirm in the app."}, f"draft {kind}", None, action)

    def _validated(self, customer_name, amount, description, currency):
        name, desc = str(customer_name).strip(), str(description).strip()
        amt = to_decimal(amount)
        if not name or len(name) > 120 or not desc or len(desc) > 240 or amt <= 0 or amt > 1_000_000:
            raise ValueError("Customer name, a positive amount (max 1,000,000) and a short description are required.")
        cur = str(currency or self.settings.paypal_default_currency).upper()
        if len(cur) != 3:
            raise ValueError("Currency must be a 3-letter code.")
        return name, amt, desc, cur

    def _t_prepare_payment_request(self, customer_name, amount, description, currency=None):
        name, amt, desc, cur = self._validated(customer_name, amount, description, currency)
        warns = [f"{w['title']}: {w['explanation']}" for w in payments_service.check_warnings(self.db, self.user, name, amt, cur, self.settings.mode == "demo")]
        preview = f"Payment request: {name} - {format_money(amt, cur)} for \"{desc}\""
        return self._draft("payment_request", {"customer_name": name, "amount": str(amt), "currency": cur, "description": desc}, warns, preview)

    def _t_prepare_invoice(self, customer_name, amount, description, customer_email=None, quantity=1, tax_rate=0, due_in_days=14, currency=None):
        name, price, desc, cur = self._validated(customer_name, amount, description, currency)
        qty, due = to_decimal(quantity), max(0, min(int(due_in_days), 365))
        if qty <= 0:
            raise ValueError("Quantity must be above zero.")
        payload = {"customer_name": name, "customer_email": customer_email, "currency": cur, "tax_rate": str(tax_rate or 0), "due_in_days": due,
                   "items": [{"description": desc, "quantity": str(qty), "unit_price": str(price)}]}
        preview = f"Invoice: {name} - {format_money(price * qty, cur)} for \"{desc}\", due in {due} days"
        return self._draft("invoice", payload, [], preview)
