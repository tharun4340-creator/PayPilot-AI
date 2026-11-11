"""End-to-end API tests. Need the full dependencies (pip install -r requirements.txt); skipped otherwise."""
import pytest

pytest.importorskip("fastapi")
pytest.importorskip("sqlalchemy")
pytest.importorskip("httpx")

from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.deps import get_paypal, reset_rate_limits  # noqa: E402
from app.database.session import init_db  # noqa: E402
from app.main import app  # noqa: E402
from app.services.paypal_client import PayPalError  # noqa: E402


class FakePayPal:
    """Stands in for PayPal. Orders only become COMPLETED after approve() + capture, like the real flow."""

    def __init__(self):
        self.orders, self.verify_ok = {}, False

    def create_order(self, amount, currency, description, reference_id, return_url, cancel_url, request_id, brand_name="x"):
        oid = f"ORD{len(self.orders) + 1}"
        self.orders[oid] = {"id": oid, "status": "CREATED", "amount": f"{float(amount):.2f}", "currency": currency}
        return {"id": oid, "status": "PAYER_ACTION_REQUIRED", "links": [{"rel": "payer-action", "href": f"https://paypal.test/{oid}"}]}

    def approve(self, oid):
        self.orders[oid]["status"] = "APPROVED"

    def get_order(self, oid):
        o = self.orders[oid]
        pu = {"amount": {"currency_code": o["currency"], "value": o["amount"]}}
        if o["status"] == "COMPLETED":
            pu["payments"] = {"captures": [{"id": "CAP1", "status": "COMPLETED"}]}
        return {"id": oid, "status": o["status"], "purchase_units": [pu]}

    def capture_order(self, oid, request_id):
        if self.orders[oid]["status"] != "APPROVED":
            raise PayPalError(422, "x", issue="ORDER_NOT_APPROVED")
        self.orders[oid]["status"] = "COMPLETED"
        return {}

    def verify_webhook_signature(self, headers, event, webhook_id):
        return self.verify_ok


@pytest.fixture(scope="module")
def client():
    get_settings.cache_clear()
    init_db()
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _reset():
    reset_rate_limits()


def signup(client, email="a@example.com"):
    r = client.post("/api/v1/auth/register", json={"email": email, "password": "password123", "full_name": "Asha"})
    assert r.status_code == 201, r.text
    return {"Authorization": "Bearer " + r.json()["access_token"]}


def test_auth_flow_and_protection(client):
    assert client.get("/api/v1/auth/me").status_code == 401
    h = signup(client)
    assert client.get("/api/v1/auth/me", headers=h).json()["email"] == "a@example.com"
    assert client.post("/api/v1/auth/register", json={"email": "a@example.com", "password": "password123", "full_name": "x"}).status_code == 409
    assert client.post("/api/v1/auth/login", json={"email": "a@example.com", "password": "wrongpass"}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "a@example.com", "password": "password123"}).status_code == 200


def test_logout_revokes_the_current_access_token(client):
    headers = signup(client, "logout@example.com")
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert client.post("/api/v1/auth/logout", headers=headers).json() == {"ok": True}
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_demo_dashboard_and_assistant_confirmation(client):
    h = signup(client, "b@example.com")
    assert client.get("/api/v1/analytics/dashboard", headers=h).json()["data_mode"] == "empty"
    assert client.post("/api/v1/demo/seed", headers=h).json()["created"]["payments"] > 0
    d = client.get("/api/v1/analytics/dashboard", headers=h).json()
    assert d["data_mode"] == "demo" and d["totals"]["received"] > 0
    chat = client.post("/api/v1/assistant/chat", headers=h, json={"message": "Create a payment request for Rahul for 1500 for website design", "language": "en"}).json()
    assert chat["mode"] == "demo"
    action = chat["reply"]["pending_action"]
    assert action["status"] == "PENDING" and action["payload"]["customer_name"] == "Rahul"
    assert client.get("/api/v1/payments?source=real", headers=h).json()["total"] == 0  # nothing created before confirmation
    done = client.post(f"/api/v1/assistant/actions/{action['id']}/confirm", headers=h, json={}).json()
    assert done["payment"]["is_demo"] is True and done["payment"]["approval_url"] is None
    assert client.post(f"/api/v1/assistant/actions/{action['id']}/confirm", headers=h, json={}).status_code == 409


def test_invoice_and_pdf(client):
    h = signup(client, "c@example.com")
    body = {"customer_name": "Meera", "items": [{"description": "Logo", "quantity": 2, "unit_price": 100}], "tax_rate": 10, "due_date": "2099-01-01"}
    inv = client.post("/api/v1/invoices", headers=h, json=body).json()
    assert inv["total"] == 220.0 and inv["number"].startswith("INV-")
    assert client.post("/api/v1/invoices", headers=h, json=body).json()["warnings"]  # duplicate hint
    pdf = client.get(f"/api/v1/invoices/{inv['id']}/pdf", headers=h)
    assert pdf.headers["content-type"] == "application/pdf" and pdf.content.startswith(b"%PDF")


def test_paypal_order_capture_flow_and_authorization(client):
    fake = FakePayPal()
    app.dependency_overrides[get_paypal] = lambda: fake
    h, other = signup(client, "d@example.com"), signup(client, "e@example.com")
    body = {"customer_name": "Rahul", "amount": 25, "currency": "USD", "description": "Design", "confirm": True, "idempotency_key": "key-12345678"}
    assert client.post("/api/v1/payments", headers=h, json={**body, "confirm": False}).status_code == 400
    p = client.post("/api/v1/payments", headers=h, json=body).json()
    assert p["status"] == "CREATED" and p["approval_url"].startswith("https://paypal.test/") and p["is_demo"] is False
    assert client.post("/api/v1/payments", headers=h, json=body).json()["id"] == p["id"]  # idempotent
    cap = {"confirm": True, "idempotency_key": "cap-12345678"}
    assert client.post(f"/api/v1/payments/{p['id']}/capture", headers=h, json=cap).status_code == 409  # not approved yet
    assert client.get(f"/api/v1/payments/{p['id']}", headers=other).status_code == 404  # other user cannot see it
    fake.approve(p["paypal_order_id"])
    done = client.post(f"/api/v1/payments/{p['id']}/capture", headers=h, json=cap).json()
    assert done["status"] == "COMPLETED" and done["paypal_capture_id"] == "CAP1"
    assert client.post(f"/api/v1/payments/{p['id']}/verify", headers=h).json()["status"] == "COMPLETED"


def test_webhook_rejects_bad_signature_and_ignores_duplicates(client):
    fake = FakePayPal()
    app.dependency_overrides[get_paypal] = lambda: fake
    event = {"id": "WH-EVT-1", "event_type": "CHECKOUT.ORDER.APPROVED", "resource": {"id": "UNKNOWN"}}
    assert client.post("/api/v1/webhooks/paypal", json=event).status_code == 400
    fake.verify_ok = True
    assert client.post("/api/v1/webhooks/paypal", json=event).json() == {"ok": True, "duplicate": False}
    assert client.post("/api/v1/webhooks/paypal", json=event).json() == {"ok": True, "duplicate": True}
