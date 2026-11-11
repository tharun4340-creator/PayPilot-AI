"""Plain-language troubleshooting hints for failed payments."""
from __future__ import annotations

RULES = [
    (("declin", "instrument"), "The payer's payment method was declined. Ask them to try another PayPal funding source or card."),
    (("currency",), "PayPal may not support this currency for your account or country. Try another currency such as USD."),
    (("credential", "401", "unauthor"), "PayPal rejected the API credentials. Check PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET and that they match the sandbox/live setting."),
    (("approve", "not approved", "payer action"), "The customer has not approved the payment on PayPal yet. Resend the approval link."),
    (("amount",), "PayPal reported a different amount than requested. Do not treat this as paid; review the payment in PayPal."),
    (("void", "expired", "cancel"), "The order was cancelled or expired. Create a new payment request."),
]


def hints_for(reason: str) -> list:
    low = (reason or "").lower()
    hints = [text for keys, text in RULES if any(k in low for k in keys)]
    return hints or ["Open the payment, press Verify with PayPal to refresh its status, and check the payment history for details."]
