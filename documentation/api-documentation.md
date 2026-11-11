# PayPilot AI — API Documentation

Base URL: `http://localhost:8000/api/v1` (override in the frontend with `VITE_API_URL`).
Interactive Swagger UI: `http://localhost:8000/docs` · ReDoc: `/redoc`.

All endpoints except `/system/status`, `/auth/register`, `/auth/login` and `/webhooks/paypal`
require `Authorization: Bearer <JWT>`. Errors are JSON: `{"detail": "plain-language message"}`
(validation errors may return `detail` as a list; clients should show a generic message in that case).

## Conventions

- Money amounts are JSON numbers with 2 decimals. Currency is an ISO code string.
- Timestamps are ISO-8601 UTC strings.
- Every record that may be sample data carries `is_demo: boolean`. UI must label `is_demo=true` as **DEMO DATA**.
- `source` query parameter (where present): `auto` (default) | `real` | `demo` | `all`.
  `auto` = real records if any exist, otherwise demo records.
- State-changing financial endpoints require `"confirm": true` in the body and accept an
  `idempotency_key` (string, client-generated UUID). Repeating the same key returns the original result.

## Objects

**User** `{id, email, full_name, business_name, language: "en"|"ta"|"hi", onboarding_completed, created_at}`

**Customer** `{id, name, email, phone, is_demo, created_at, total_paid, payment_count}`

**Payment**
`{id, customer_id, customer_name, customer_email, description, amount, currency,
status, paypal_order_id, approval_url, paypal_capture_id, paypal_status, failure_reason,
invoice_id, source: "manual"|"assistant"|"invoice", is_demo, created_at, updated_at, completed_at, verified_at}`

`status` ∈ `CREATED` (order created, waiting for payer approval) · `APPROVED` (payer approved, not yet captured) ·
`COMPLETED` · `FAILED` · `CANCELLED`.
UI groups: pending = CREATED + APPROVED; completed = COMPLETED; failed = FAILED + CANCELLED.
A payment is only `COMPLETED` after the backend has read the order/capture status from PayPal itself.
Demo records (`is_demo=true`) never touch PayPal.

**Invoice**
`{id, number, customer_id, customer_name, customer_email, status: "DRAFT"|"UNPAID"|"PAID"|"OVERDUE"|"CANCELLED",
issue_date, due_date, currency, tax_rate, subtotal, tax_amount, total, notes,
items: [{description, quantity, unit_price, amount}], payment_id, payment_status,
paypal_invoice_id, paypal_invoice_url, paypal_invoice_status, is_demo, created_at, warnings: [string]}`

**Alert** `{id, type, severity: "info"|"warning"|"high", title, explanation, payment_ids: [id], created_at}`
Alerts are advisory indicators only; nothing is blocked automatically.

**PendingAction** (AI-prepared, not yet executed)
`{id, kind: "payment_request"|"invoice", status: "PENDING"|"CONFIRMED"|"CANCELLED", payload: {...}, preview_text, warnings: [string], result: object|null}`

## System

| Method | Path | Description |
|---|---|---|
| GET | `/system/status` | `{mode: "demo"|"sandbox"|"live", paypal_configured, paypal_env, llm_configured, llm_provider, default_currency, languages: ["en","ta","hi"], webhook_configured}` |

## Auth & profile

| Method | Path | Body → Response |
|---|---|---|
| POST | `/auth/register` | `{email, password (min 8), full_name}` → `{access_token, token_type: "bearer", user}` |
| POST | `/auth/login` | `{email, password}` → `{access_token, token_type, user}` (rate limited) |
| GET | `/auth/me` | → `User` |
| POST | `/auth/logout` | → `{ok: true}` (JWT is stateless; the client discards it; the event is audit-logged) |
| PATCH | `/users/me` | `{full_name?, business_name?, language?, onboarding_completed?}` → `User` |

## Customers

| GET | `/customers` | → `[Customer]` |
|---|---|---|
| POST | `/customers` | `{name, email?, phone?}` → `Customer` |
| GET | `/customers/{id}` | → `{customer: Customer, payments: [Payment], invoices: [Invoice], totals: {paid, pending, count}}` |

## Payments

| Method | Path | Description |
|---|---|---|
| GET | `/payments?status=&q=&source=&limit=&offset=` | `status` ∈ `pending|completed|failed|all`. → `{items: [Payment], total}` |
| POST | `/payments` | `{customer_name, customer_email?, amount, currency?, description, invoice_id?, confirm: true, idempotency_key}` → `Payment`. Creates a PayPal Checkout order (sandbox) and returns `approval_url`. In demo mode (no PayPal credentials) a clearly flagged demo record is created and no payment is initiated. Rejected with 400 unless `confirm` is true. Response may include `warnings`. |
| GET | `/payments/{id}` | → `{payment: Payment, events: [{time, type, message}], safety_warnings: [string]}` |
| POST | `/payments/{id}/verify` | Re-reads the order from PayPal and updates local status → `Payment` |
| POST | `/payments/{id}/capture` | `{confirm: true, idempotency_key}`; backend checks the order is `APPROVED` at PayPal, captures it, re-verifies → `Payment` |
| GET | `/payments/by-order/{paypal_order_id}` | Used by the checkout return page. Verifies with PayPal, returns `Payment` |

PayPal checkout `return_url` = `{FRONTEND_URL}/payments/return`, `cancel_url` = `{FRONTEND_URL}/payments/cancelled`.
PayPal appends `?token=<ORDER_ID>&PayerID=...` to the return URL.

## Invoices

| Method | Path | Description |
|---|---|---|
| GET | `/invoices?status=&q=&source=` | → `[Invoice]` |
| POST | `/invoices` | `{customer_name, customer_email?, items: [{description, quantity, unit_price}], tax_rate?, due_date, currency?, notes?, create_paypal_invoice?: bool}` → `Invoice` (with `warnings`, e.g. possible duplicate) |
| GET | `/invoices/{id}` | → `Invoice` |
| PATCH | `/invoices/{id}` | `{status: "CANCELLED"|"UNPAID"}` → `Invoice` |
| GET | `/invoices/{id}/pdf` | → `application/pdf` download |
| POST | `/invoices/{id}/pay` | `{confirm: true, idempotency_key}` → `Payment` (creates a Checkout order for the invoice total) |
| POST | `/invoices/{id}/send` | `{confirm: true}` → `Invoice`. Sends the PayPal draft invoice (only when a PayPal invoice exists). |
| POST | `/invoices/check-duplicate` | `{customer_name, total}` → `{duplicates: [Invoice]}` |
| POST | `/invoices/suggest-description` | `{text, language}` → `{suggestions: [string], generated_by: "llm"|"rule-based"}` |

## Analytics

| Method | Path | Description |
|---|---|---|
| GET | `/analytics/dashboard?source=` | `{data_mode: "real"|"demo"|"empty", totals: {received, sent: null, pending_amount, pending_count, completed_count, failed_count, currency}, monthly: [{month: "YYYY-MM", received, count}], recent: [Payment], timeline: [{time, type, message}], top_customers: [{name, total, count}], insights: [{title, body, kind: "info"|"positive"|"caution"}], alert_count}` |
| GET | `/analytics/insights?source=` | `{data_mode, summary: {...}, monthly, categories: [{category, total, count}], customer_patterns: [{name, count, total, average, last_payment}], alerts: [Alert], ai_summary: {text, generated_by: "llm"|"rule-based"}, disclaimer}` |
| POST | `/analytics/ask` | `{question, language}` → `{answer, generated_by, data_mode, disclaimer}` |
| GET | `/analytics/report?month=YYYY-MM&source=` | Monthly business report: `{month, data_mode, totals, top_customers, categories, text, generated_by}` |
| GET | `/analytics/report.csv?month=&source=` | CSV download of that month's transactions |

## Safety

| Method | Path | Description |
|---|---|---|
| GET | `/safety/alerts?source=` | → `{items: [Alert], disclaimer}` |
| GET | `/safety/activity?limit=` | User's own audit log → `[{id, time, action, details}]` |
| POST | `/safety/check-payment` | `{customer_name, amount, currency}` → `{warnings: [Alert-like {type, severity, title, explanation}]}` |

## AI assistant

| Method | Path | Description |
|---|---|---|
| POST | `/assistant/chat` | `{message, conversation_id?, language}` → `{conversation_id, mode: "llm"|"demo", reply: Message}` |
| POST | `/assistant/actions/{id}/confirm` | `{idempotency_key}` → `{action: PendingAction, payment?: Payment, invoice?: Invoice, message: string}` |
| POST | `/assistant/actions/{id}/cancel` | → `{action: PendingAction}` |
| GET | `/assistant/conversations` | → `[{id, title, updated_at}]` |
| GET | `/assistant/conversations/{id}` | → `{id, messages: [Message]}` |

`Message` = `{id, role: "user"|"assistant", content, created_at, mode: "llm"|"demo", tool_calls: [{name, arguments, summary}], data: null | {type: "payments"|"invoices"|"customers"|"summary"|"report", ...}, pending_action: PendingAction|null}`.

The assistant can read data and **prepare** payment requests / invoices. It can never execute a
financial action: only the user's explicit call to `/assistant/actions/{id}/confirm` does.
In `demo` mode (no LLM key) replies are produced by a deterministic command parser, and
`Message.mode == "demo"`; the UI labels it as such.

## Notifications & reminders

| Method | Path | Description |
|---|---|---|
| GET | `/notifications` | → `[{id, title, body, level: "info"|"warning"|"success", read, created_at}]` |
| POST | `/notifications/{id}/read` | → `{ok: true}` |
| POST | `/notifications/read-all` | → `{ok: true}` |
| POST | `/notifications/generate-reminders` | Creates in-app reminder notifications for overdue/soon-due invoices (no email is sent) → `{created: number, items: [{invoice_id, number, customer_name, days_overdue, message}]}` |

## Demo data

| POST | `/demo/seed` | Creates sample customers/invoices/payments flagged `is_demo=true` → `{created: {customers, invoices, payments}}` |
|---|---|---|
| DELETE | `/demo` | Removes this user's demo data → `{removed: number}` |

## Webhooks

`POST /webhooks/paypal` — public. The backend verifies the signature with PayPal's
`/v1/notifications/verify-webhook-signature` using `PAYPAL_WEBHOOK_ID`, stores the event id (duplicates
are ignored), and updates the matching payment after re-reading it from PayPal.
Returns 200 `{ok: true}` for valid or duplicate events, 400 for invalid signatures.
