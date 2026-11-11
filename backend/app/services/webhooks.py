"""Pure webhook helpers."""
from __future__ import annotations

HANDLED_EVENTS = ("CHECKOUT.ORDER.APPROVED", "CHECKOUT.ORDER.COMPLETED", "PAYMENT.CAPTURE.COMPLETED",
                  "PAYMENT.CAPTURE.DENIED", "PAYMENT.CAPTURE.PENDING", "PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED")


def extract_order_id(event: dict):
    res = event.get("resource") or {}
    etype = event.get("event_type", "")
    if etype.startswith("CHECKOUT.ORDER"):
        return res.get("id")
    if etype.startswith("PAYMENT.CAPTURE"):
        return ((res.get("supplementary_data") or {}).get("related_ids") or {}).get("order_id")
    return None
