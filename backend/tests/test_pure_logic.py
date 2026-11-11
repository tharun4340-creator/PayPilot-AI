"""Tests for framework-free logic. These run without FastAPI/SQLAlchemy."""
from datetime import datetime, timedelta
from decimal import Decimal

import pytest

from app.core.config import Settings
from app.core.security import (RateLimiter, TokenError, create_access_token, decode_access_token, hash_password, verify_password)
from app.services import analytics, i18n, reports, safety
from app.services.command_parser import parse_command
from app.services.invoice_pdf import render_invoice_pdf
from app.services.llm import LLMClient, LLMError, narrative
from app.services.money import calc_totals, format_money
from app.services.paypal_client import PayPalClient, PayPalError, approval_url_from, map_order_status
from app.services.troubleshooting import hints_for
from app.services.webhooks import extract_order_id

NOW = datetime(2026, 11, 9, 12, 0)


def row(i, name="Rahul", amount=100.0, status="COMPLETED", days=1, cur="USD", desc="Website design"):
    d = NOW - timedelta(days=days)
    return {"id": i, "customer_name": name, "amount": amount, "currency": cur, "status": status, "description": desc,
            "created_at": d, "completed_at": d if status == "COMPLETED" else None, "is_demo": False}


# ---- security
def test_password_hash_and_verify():
    h = hash_password("correct horse")
    assert "correct horse" not in h and h.startswith("scrypt$")
    assert verify_password("correct horse", h) and not verify_password("wrong", h) and not verify_password("x", "garbage")
    assert hash_password("correct horse") != h  # random salt


def test_jwt_roundtrip_and_tamper():
    tok = create_access_token(7, "s" * 40, 5)
    assert decode_access_token(tok, "s" * 40)["sub"] == "7"
    with pytest.raises(TokenError):
        decode_access_token(tok, "other" * 10)
    with pytest.raises(TokenError):
        decode_access_token(create_access_token(7, "s" * 40, -1), "s" * 40)


def test_rate_limiter():
    rl = RateLimiter()
    assert all(rl.allow("k", 3, 60, now=i) for i in range(3))
    assert not rl.allow("k", 3, 60, now=3)
    assert rl.allow("k", 3, 60, now=100)


def test_meta_llm_provider_defaults(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-long-enough-for-tests")
    monkeypatch.setenv("LLM_PROVIDER", "meta")
    monkeypatch.setenv("LLM_API_KEY", "test-meta-key")
    monkeypatch.setenv("LLM_MODEL", "")
    monkeypatch.setenv("LLM_BASE_URL", "")

    settings = Settings.from_env()

    assert settings.llm_configured
    assert settings.llm_provider == "meta"
    assert settings.llm_model == "muse-spark-1.3"
    assert settings.llm_base_url == "https://api.meta.ai/v1"


# ---- money
def test_calc_totals():
    r = calc_totals([{"description": "a", "quantity": 2, "unit_price": "10.005"}, {"description": "b", "quantity": 1, "unit_price": 5}], 18)
    assert r["subtotal"] == Decimal("25.01") and r["tax_amount"] == Decimal("4.50") and r["total"] == Decimal("29.51")
    with pytest.raises(ValueError):
        calc_totals([])
    with pytest.raises(ValueError):
        calc_totals([{"description": "a", "quantity": 0, "unit_price": 1}])
    assert format_money(1500, "INR") == "₹1,500.00" and format_money(5, "CHF") == "CHF 5.00"


# ---- command parser
def test_parse_payment_request():
    p = parse_command("Create a payment request for Rahul for ₹1500 for website design.")
    assert (p["intent"], p["customer_name"], p["amount"], p["currency"], p["description"]) == ("payment_request", "Rahul", Decimal("1500"), "INR", "website design")
    assert p["missing"] == []

    suggestion = parse_command("Create a payment request for Asha for 500 for design work")
    assert (suggestion["intent"], suggestion["customer_name"], suggestion["amount"], suggestion["description"]) == (
        "payment_request", "Asha", Decimal("500"), "design work",
    )


def test_parse_invoice_missing_fields_voice():
    p = parse_command("create an invoice for 2000 rupees")
    assert p["intent"] == "invoice" and p["amount"] == Decimal("2000") and p["currency"] == "INR"
    assert set(p["missing"]) == {"customer_name", "description"}


def test_parse_variants():
    p = parse_command("bill priya nair $250 for logo design")
    assert p["customer_name"] == "Priya Nair" and p["currency"] == "USD" and p["description"] == "logo design"
    assert parse_command("charge Arjun 1,200 for hosting")["amount"] == Decimal("1200")
    assert parse_command("Create invoice for a customer")["customer_name"] is None


@pytest.mark.parametrize("text,intent", [
    ("Show my recent payments", "recent_payments"), ("Find my pending payments", "pending_payments"),
    ("Summarize this month's transactions", "month_summary"), ("Show my top customers", "top_customers"),
    ("Generate a monthly payment report", "monthly_report"), ("Explain why a payment failed", "explain_failure"),
    ("help", "help"), ("blah blah", "unknown"), ("मेरे लंबित भुगतान दिखाओ", "pending_payments"),
])
def test_intents(text, intent):
    assert parse_command(text)["intent"] == intent


# ---- safety
def test_duplicate_and_outlier_alerts():
    rows = [row(i, "Meera", 100 + i, days=i + 5) for i in range(1, 8)]
    rows += [row(20, "Rahul", 320, days=1), row(21, "Rahul", 320, status="CREATED", days=0), row(22, "Newco", 5000, days=2)]
    types = {a["type"] for a in safety.detect_alerts(rows, NOW)}
    assert {"duplicate_payment", "unusual_amount"} <= types
    assert all("not proof" in a["explanation"] for a in safety.detect_alerts(rows, NOW))


def test_check_new_payment_and_failed_streak():
    hist = [row(1, "Rahul", 50, days=0)]
    assert [w["type"] for w in safety.check_new_payment(hist, "rahul", 50.0, "USD", NOW)] == ["duplicate_payment"]
    assert safety.check_new_payment(hist, "Other", 50.0, "USD", NOW) == []
    failed = [row(i, "X", 10, status="FAILED", days=1) for i in range(3)]
    assert any(a["type"] == "failed_streak" for a in safety.detect_alerts(failed, NOW))


# ---- analytics
def test_analytics_totals_series_categories():
    rows = [row(1, "A", 100, days=2), row(2, "A", 50, days=40, desc="Logo design"), row(3, "B", 70, status="CREATED"),
            row(4, "B", 30, status="FAILED"), row(5, "C", 999, cur="EUR")]
    t = analytics.totals(rows, "USD")
    assert t["received"] == 150 and t["pending_count"] == 1 and t["failed_count"] == 1 and t["excluded_other_currency_count"] == 1 and t["sent"] is None
    series = analytics.monthly_series(rows, 3, NOW, "USD")
    assert [s["month"] for s in series] == ["2026-09", "2026-10", "2026-11"] and series[-1]["received"] == 100
    assert analytics.categorize("Monthly retainer") == "Subscriptions & Retainers" and analytics.categorize("quiz") == "Other"
    assert analytics.top_customers(rows, "USD")[0]["name"] == "A"
    assert "2026-11" in analytics.monthly_report(rows, "2026-11", "USD")["text"]
    assert analytics.primary_currency(rows, "INR") == "USD"
    assert analytics.build_insights([], NOW, "USD")[0]["kind"] == "info"


def test_csv_injection_neutralised():
    r = row(1, "=HYPERLINK(\"x\")", 5)
    out = reports.rows_to_csv([r])
    assert "'=HYPERLINK" in out and out.splitlines()[0].startswith("id,date")


# ---- PayPal client (fake HTTP session, no network)
class Resp:
    def __init__(self, code, data):
        self.status_code, self._d = code, data
        self.text = "x" if data is not None else ""

    def json(self):
        return self._d


class FakeSession:
    def __init__(self, routes):
        self.routes, self.calls = routes, []

    def request(self, method, url, **kw):
        self.calls.append((method, url, kw))
        for (m, suffix), resp in self.routes.items():
            if m == method and url.endswith(suffix):
                return resp
        return Resp(404, {"message": "nf"})


def test_paypal_create_order_and_token_reuse():
    s = FakeSession({("POST", "/v1/oauth2/token"): Resp(200, {"access_token": "tok", "expires_in": 3000}),
                     ("GET", "/v2/checkout/orders/ORD1"): Resp(200, {"id": "ORD1", "status": "CREATED"}),
                     ("POST", "/v2/checkout/orders"): Resp(201, {"id": "ORD1", "status": "PAYER_ACTION_REQUIRED",
                                                                "links": [{"rel": "payer-action", "href": "https://pp/approve"}]})})
    c = PayPalClient("id", "secret", "sandbox", session=s)
    o = c.create_order(Decimal("15"), "USD", "Design", "PP-1", "http://r", "http://c", "req-1")
    assert approval_url_from(o) == "https://pp/approve"
    sent = [k for m, u, k in s.calls if u.endswith("/v2/checkout/orders")][0]
    assert sent["json"]["purchase_units"][0]["amount"] == {"currency_code": "USD", "value": "15.00"}
    assert sent["headers"]["PayPal-Request-Id"] == "req-1" and "sandbox" in s.calls[0][1]
    c.get_order("ORD1")
    assert sum(1 for m, u, k in s.calls if u.endswith("/oauth2/token")) == 1


def test_paypal_errors_are_friendly():
    s = FakeSession({("POST", "/v1/oauth2/token"): Resp(401, {"error": "invalid_client", "error_description": "bad"})})
    with pytest.raises(PayPalError) as e:
        PayPalClient("id", "bad", session=s).get_order("X")
    assert "credentials" in e.value.friendly()
    assert "USD" in PayPalError(422, "x", issue="CURRENCY_NOT_SUPPORTED").friendly("USD") and "declined" in PayPalError(422, "x", issue="INSTRUMENT_DECLINED").friendly()


def order(status, cap=None, value="15.00", cur="USD"):
    pu = {"amount": {"currency_code": cur, "value": value}}
    if cap:
        pu["payments"] = {"captures": [cap]}
    return {"id": "O", "status": status, "purchase_units": [pu]}


def test_map_order_status_never_fakes_success():
    assert map_order_status(order("CREATED"), 15, "USD").status == "CREATED"
    assert map_order_status(order("APPROVED"), 15, "USD").status == "APPROVED"
    done = map_order_status(order("COMPLETED", {"id": "C1", "status": "COMPLETED"}), 15, "USD")
    assert done.status == "COMPLETED" and done.capture_id == "C1"
    assert map_order_status(order("COMPLETED", {"id": "C1", "status": "PENDING"}), 15, "USD").status == "APPROVED"
    assert map_order_status(order("COMPLETED"), 15, "USD").status == "APPROVED"  # no capture found
    assert map_order_status(order("COMPLETED", {"id": "C", "status": "DECLINED"}), 15, "USD").status == "FAILED"
    assert map_order_status(order("VOIDED"), 15, "USD").status == "CANCELLED"
    bad = map_order_status(order("COMPLETED", {"id": "C", "status": "COMPLETED"}, value="1.00"), 15, "USD")
    assert bad.status == "FAILED" and bad.mismatch
    assert map_order_status(order("COMPLETED", {"id": "C", "status": "COMPLETED"}, cur="EUR"), 15, "USD").mismatch


def test_webhook_verification_and_order_id():
    s = FakeSession({("POST", "/v1/oauth2/token"): Resp(200, {"access_token": "t", "expires_in": 999}),
                     ("POST", "/v1/notifications/verify-webhook-signature"): Resp(200, {"verification_status": "FAILURE"})})
    c = PayPalClient("i", "s", session=s)
    hdrs = {"PayPal-Auth-Algo": "a", "PayPal-Cert-Url": "u", "PayPal-Transmission-Id": "i", "PayPal-Transmission-Sig": "s", "PayPal-Transmission-Time": "t"}
    assert c.verify_webhook_signature(hdrs, {"id": "E"}, "WH") is False
    assert c.verify_webhook_signature({}, {"id": "E"}, "WH") is False  # missing headers
    assert extract_order_id({"event_type": "CHECKOUT.ORDER.APPROVED", "resource": {"id": "O1"}}) == "O1"
    assert extract_order_id({"event_type": "PAYMENT.CAPTURE.COMPLETED", "resource": {"supplementary_data": {"related_ids": {"order_id": "O2"}}}}) == "O2"


# ---- LLM client (fake HTTP)
class LLMSession:
    def __init__(self, replies):
        self.replies, self.bodies = list(replies), []

    def post(self, url, headers, json, timeout):
        self.bodies.append(json)
        return Resp(200, self.replies.pop(0))


TOOLS = [{"name": "list_recent_payments", "description": "d", "input_schema": {"type": "object", "properties": {}}}]


def test_llm_anthropic_tool_loop():
    sess = LLMSession([{"content": [{"type": "tool_use", "id": "t1", "name": "list_recent_payments", "input": {"limit": 2}}]},
                       {"content": [{"type": "text", "text": "You have 2 payments."}]}])
    calls = []
    out = LLMClient("anthropic", "k", "m", session=sess).run("sys", [{"role": "user", "content": "hi"}], TOOLS, lambda n, a: calls.append((n, a)) or "{}")
    assert out == "You have 2 payments." and calls == [("list_recent_payments", {"limit": 2})]
    assert sess.bodies[1]["messages"][-1]["content"][0]["type"] == "tool_result"


def test_llm_openai_tool_loop_and_errors():
    sess = LLMSession([{"choices": [{"message": {"content": None, "tool_calls": [{"id": "c1", "function": {"name": "list_recent_payments", "arguments": "{\"limit\":1}"}}]}}]},
                       {"choices": [{"message": {"content": "Done."}}]}])
    assert LLMClient("openai", "k", "m", session=sess).run("s", [{"role": "user", "content": "x"}], TOOLS, lambda n, a: "{}") == "Done."

    class Bad:
        def post(self, *a, **k):
            return Resp(500, {})
    with pytest.raises(LLMError):
        LLMClient("anthropic", "k", "m", session=Bad()).complete("s", "u")
    assert narrative(LLMClient("anthropic", "k", "m", session=Bad()), "s", {}, "fallback") == ("fallback", "rule-based")
    assert narrative(None, "s", {}, "fb") == ("fb", "rule-based")


def test_llm_meta_uses_compatible_chat_completions_endpoint():
    class CapturingSession:
        def __init__(self):
            self.request = None

        def post(self, url, headers, json, timeout):
            self.request = (url, headers, json)
            return Resp(200, {"choices": [{"message": {"content": "Meta assistant is ready."}}]})

    session = CapturingSession()
    llm = LLMClient("meta", "test-meta-key", "muse-spark-1.3", "https://api.meta.ai/v1", session=session)

    assert llm.complete("system", "hello") == "Meta assistant is ready."
    assert session.request[0] == "https://api.meta.ai/v1/chat/completions"
    assert session.request[1]["Authorization"] == "Bearer test-meta-key"


# ---- PDF + i18n + troubleshooting
def test_invoice_pdf_renders():
    inv = {"number": "INV-2026-0001", "status": "UNPAID", "customer_name": "Rahul", "customer_email": "r@example.com", "issue_date": "2026-11-09",
           "due_date": "2026-11-23", "currency": "INR", "tax_rate": 18, "subtotal": 1000, "tax_amount": 180, "total": 1180, "notes": "Thanks", "is_demo": True,
           "items": [{"description": "Website design <b>", "quantity": 1, "unit_price": 1000, "amount": 1000}]}
    pdf = render_invoice_pdf(inv, {"name": "Me", "email": "me@example.com"})
    assert pdf.startswith(b"%PDF") and len(pdf) > 1500


def test_i18n_complete():
    assert set(i18n.T["ta"]) == set(i18n.T["en"]) == set(i18n.T["hi"])
    assert "Rahul" in i18n.t("hi", "payment_preview", customer="Rahul", amount="₹1", description="x")
    assert i18n.t("xx", "cancelled") == i18n.T["en"]["cancelled"]


def test_troubleshooting_hints():
    assert "declined" in hints_for("Capture declined: INSTRUMENT_DECLINED")[0]
    assert len(hints_for("???")) == 1
