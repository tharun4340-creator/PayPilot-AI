"""Minimal PayPal REST client (Orders v2, Invoicing v2, webhook verification). Pure Python + requests."""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Optional


class PayPalError(Exception):
    def __init__(self, status: int, message: str, issue: Optional[str] = None, debug_id: Optional[str] = None):
        super().__init__(message)
        self.status, self.message, self.issue, self.debug_id = status, message, issue, debug_id

    def friendly(self, currency: Optional[str] = None) -> str:
        issue, low = (self.issue or "").upper(), (self.message or "").lower()
        if self.status == 401 or (self.status == 403 and not issue):
            return "PayPal did not accept the configured credentials. Check your PayPal Client ID and Secret (sandbox vs live)."
        if issue in ("CURRENCY_NOT_SUPPORTED", "UNSUPPORTED_CURRENCY", "CURRENCY_NOT_SUPPORTED_FOR_PAYEE") or "currency" in low:
            return f"PayPal does not accept {currency or 'this currency'} for this account. Try another currency such as USD."
        if issue == "INSTRUMENT_DECLINED":
            return "The payer's payment method was declined by PayPal. Ask them to choose another payment method."
        if issue == "ORDER_NOT_APPROVED":
            return "The customer has not approved this payment on PayPal yet."
        if issue == "ORDER_ALREADY_CAPTURED":
            return "This payment was already captured."
        if self.status == 0:
            return "Could not reach PayPal. Check your internet connection and try again."
        if self.status == 429:
            return "PayPal is limiting requests right now. Please wait a minute and try again."
        ref = f" (reference {self.debug_id})" if self.debug_id else ""
        return f"PayPal could not complete this request: {issue or self.message}{ref}"


def format_amount(value) -> str:
    return f"{Decimal(str(value)).quantize(Decimal('0.01')):.2f}"


def approval_url_from(order: dict) -> Optional[str]:
    for link in order.get("links") or []:
        if link.get("rel") in ("payer-action", "approve"):
            return link.get("href")
    return None


@dataclass
class OrderResult:
    status: str
    failure_reason: Optional[str]
    capture_id: Optional[str]
    mismatch: bool
    message: str


def map_order_status(order: dict, expected_amount=None, expected_currency: Optional[str] = None) -> OrderResult:
    """Translate a PayPal order into our status. Only a COMPLETED capture whose amount matches counts as paid."""
    pstatus = order.get("status")
    pu = (order.get("purchase_units") or [{}])[0]
    amt = pu.get("amount") or {}
    captures = (pu.get("payments") or {}).get("captures") or []
    cap = captures[0] if captures else None
    cap_id = cap.get("id") if cap else None
    mismatch = False
    if amt.get("value") is not None and expected_amount is not None:
        try:
            mismatch = Decimal(str(amt["value"])) != Decimal(str(expected_amount))
        except InvalidOperation:
            mismatch = True
        if expected_currency and (amt.get("currency_code") or "").upper() != expected_currency.upper():
            mismatch = True
    if mismatch:
        return OrderResult("FAILED", "PayPal reported a different amount or currency than was requested.", cap_id, True,
                           "Amount or currency mismatch reported by PayPal; not marked as paid.")
    if pstatus == "COMPLETED":
        if cap is None:
            return OrderResult("APPROVED", None, None, False, "Order is complete at PayPal but no capture was found yet.")
        cs = cap.get("status")
        if cs == "COMPLETED":
            return OrderResult("COMPLETED", None, cap_id, False, "PayPal confirmed the payment was captured.")
        if cs in ("DECLINED", "FAILED"):
            reason = (cap.get("status_details") or {}).get("reason") or cs
            return OrderResult("FAILED", f"Capture {cs.lower()}: {reason}", cap_id, False, f"PayPal reports the capture {cs.lower()}.")
        if cs == "PENDING":
            reason = (cap.get("status_details") or {}).get("reason") or "under review"
            return OrderResult("APPROVED", None, cap_id, False, f"Capture is pending at PayPal ({reason}).")
        return OrderResult("COMPLETED", None, cap_id, False, f"PayPal capture status: {cs}.")
    if pstatus == "APPROVED":
        return OrderResult("APPROVED", None, cap_id, False, "The customer approved the payment; it can now be captured.")
    if pstatus == "VOIDED":
        return OrderResult("CANCELLED", "The order was voided or expired on PayPal.", cap_id, False, "PayPal reports the order was voided.")
    return OrderResult("CREATED", None, cap_id, False, "Waiting for the customer to approve on PayPal.")


class PayPalClient:
    def __init__(self, client_id: str, client_secret: str, env: str = "sandbox", session=None, timeout: int = 20):
        self.base = "https://api-m.paypal.com" if env == "live" else "https://api-m.sandbox.paypal.com"
        self._id, self._secret, self._session, self._timeout = client_id, client_secret, session, timeout
        self._token: Optional[str] = None
        self._exp = 0.0
        self._lock = threading.Lock()

    def _http(self):
        if self._session is None:
            import requests

            self._session = requests.Session()
        return self._session

    def _send(self, method: str, path: str, **kwargs):
        try:
            resp = self._http().request(method, self.base + path, timeout=self._timeout, **kwargs)
        except Exception as exc:  # network errors
            raise PayPalError(0, "network error") from exc
        try:
            payload = resp.json() if resp.text else {}
        except ValueError:
            payload = {}
        if resp.status_code >= 400:
            details = payload.get("details") or [{}]
            raise PayPalError(resp.status_code, payload.get("message") or payload.get("error_description") or "PayPal error",
                              issue=(details[0] or {}).get("issue") or payload.get("name") or payload.get("error"),
                              debug_id=payload.get("debug_id"))
        return payload

    def _get_token(self) -> str:
        with self._lock:
            if self._token and time.time() < self._exp - 60:
                return self._token
            data = self._send("POST", "/v1/oauth2/token", auth=(self._id, self._secret), data={"grant_type": "client_credentials"},
                              headers={"Accept": "application/json"})
            self._token = data["access_token"]
            self._exp = time.time() + int(data.get("expires_in", 300))
            return self._token

    def _api(self, method: str, path: str, json=None, request_id: Optional[str] = None, prefer: bool = False):
        headers = {"Authorization": f"Bearer {self._get_token()}", "Content-Type": "application/json"}
        if request_id:
            headers["PayPal-Request-Id"] = request_id
        if prefer:
            headers["Prefer"] = "return=representation"
        return self._send(method, path, json=json, headers=headers)

    # ---- Orders v2
    def create_order(self, amount, currency: str, description: str, reference_id: str, return_url: str, cancel_url: str,
                     request_id: str, brand_name: str = "PayPilot AI") -> dict:
        body = {"intent": "CAPTURE",
                "purchase_units": [{"reference_id": reference_id, "description": description[:127],
                                    "amount": {"currency_code": currency, "value": format_amount(amount)}}],
                "payment_source": {"paypal": {"experience_context": {
                    "brand_name": brand_name, "user_action": "PAY_NOW", "shipping_preference": "NO_SHIPPING",
                    "return_url": return_url, "cancel_url": cancel_url}}}}
        return self._api("POST", "/v2/checkout/orders", json=body, request_id=request_id, prefer=True)

    def get_order(self, order_id: str) -> dict:
        return self._api("GET", f"/v2/checkout/orders/{order_id}")

    def capture_order(self, order_id: str, request_id: str) -> dict:
        return self._api("POST", f"/v2/checkout/orders/{order_id}/capture", json={}, request_id=request_id, prefer=True)

    # ---- Webhooks
    def verify_webhook_signature(self, headers: dict, event: dict, webhook_id: str) -> bool:
        h = {k.lower(): v for k, v in headers.items()}
        needed = ["paypal-auth-algo", "paypal-cert-url", "paypal-transmission-id", "paypal-transmission-sig", "paypal-transmission-time"]
        if any(not h.get(k) for k in needed):
            return False
        body = {"auth_algo": h["paypal-auth-algo"], "cert_url": h["paypal-cert-url"], "transmission_id": h["paypal-transmission-id"],
                "transmission_sig": h["paypal-transmission-sig"], "transmission_time": h["paypal-transmission-time"],
                "webhook_id": webhook_id, "webhook_event": event}
        return self._api("POST", "/v1/notifications/verify-webhook-signature", json=body).get("verification_status") == "SUCCESS"

    # ---- Invoicing v2 (availability depends on the PayPal account; callers handle PayPalError)
    def create_draft_invoice(self, number: str, currency: str, issue_date: str, due_date: str, customer_name: str,
                             customer_email: Optional[str], items: list, tax_rate, note: Optional[str] = None) -> dict:
        parts = customer_name.strip().split(" ", 1)
        billing = {"name": {"given_name": parts[0], "surname": parts[1] if len(parts) > 1 else "."}}
        if customer_email:
            billing["email_address"] = customer_email
        body = {"detail": {"invoice_number": number, "currency_code": currency, "invoice_date": issue_date,
                           "payment_term": {"due_date": due_date}, **({"note": note[:4000]} if note else {})},
                "primary_recipients": [{"billing_info": billing}],
                "items": [{"name": i["description"][:200], "quantity": str(i["quantity"]),
                           "unit_amount": {"currency_code": currency, "value": format_amount(i["unit_price"])},
                           **({"tax": {"name": "Tax", "percent": str(tax_rate)}} if Decimal(str(tax_rate or 0)) > 0 else {})} for i in items],
                "configuration": {"tax_inclusive": False}}
        res = self._api("POST", "/v2/invoicing/invoices", json=body)
        href = res.get("href", "")
        return {"id": href.rstrip("/").split("/")[-1], "href": href}

    def send_invoice(self, invoice_id: str) -> dict:
        return self._api("POST", f"/v2/invoicing/invoices/{invoice_id}/send", json={"send_to_recipient": True, "send_to_invoicer": False})
