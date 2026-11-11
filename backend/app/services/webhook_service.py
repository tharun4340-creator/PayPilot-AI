from __future__ import annotations

import json
import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.errors import AppError
from app.models import Payment, WebhookEvent
from app.services import payments_service
from app.services.audit import log_action
from app.services.paypal_client import PayPalError
from app.services.webhooks import HANDLED_EVENTS, extract_order_id

log = logging.getLogger("paypilot.webhooks")


def process(db, settings, paypal, headers: dict, body: bytes) -> dict:
    if paypal is None or not settings.paypal_webhook_id:
        raise AppError(503, "Webhooks are not configured (PAYPAL_WEBHOOK_ID is missing).")
    try:
        event = json.loads(body)
        if not isinstance(event, dict):
            raise ValueError
    except ValueError as exc:
        raise AppError(400, "Invalid webhook body.") from exc
    try:
        verified = paypal.verify_webhook_signature(headers, event, settings.paypal_webhook_id)
    except PayPalError as exc:
        raise AppError(503, "Could not verify the webhook with PayPal right now.") from exc  # 5xx => PayPal retries
    if not verified:
        log_action(db, None, "webhook.rejected", f"event {event.get('id')}")
        db.commit()
        raise AppError(400, "Invalid webhook signature.")
    event_id = str(event.get("id") or "")
    if not event_id:
        raise AppError(400, "Webhook event has no id.")
    if db.scalar(select(WebhookEvent.id).where(WebhookEvent.paypal_event_id == event_id)):
        return {"ok": True, "duplicate": True}
    record = WebhookEvent(paypal_event_id=event_id, event_type=event.get("event_type", ""), resource_id=(event.get("resource") or {}).get("id"),
                          verified=True, payload_json=json.dumps(event)[:20000])
    db.add(record)
    try:
        db.flush()
    except IntegrityError:  # concurrent redelivery
        db.rollback()
        return {"ok": True, "duplicate": True}
    order_id = extract_order_id(event) if event.get("event_type") in HANDLED_EVENTS else None
    if order_id:
        payment = db.scalar(select(Payment).where(Payment.paypal_order_id == order_id))
        if payment:
            try:
                payments_service.sync_from_paypal(db, payment, paypal, source="webhook")
                record.processed = True
            except PayPalError as exc:
                log.warning("webhook sync failed: %s", exc.issue or exc.status)
    db.commit()
    return {"ok": True, "duplicate": False}
