# PayPilot AI — Architecture

```
React (Vite, Tailwind)  ──HTTP/JSON──►  FastAPI (/api/v1)  ──►  SQLAlchemy ──► SQLite | PostgreSQL
 pages / contexts / i18n                routes → services           │
                                           │                         └─ Alembic migrations
                                           ├─► PayPal REST (Orders v2, Invoicing v2, Webhook verify)  [backend only]
                                           └─► LLM API (Anthropic / OpenAI-compatible, tool calling)  [optional]
```

## Backend layout (`backend/app`)
| Folder | Role |
|---|---|
| `core/` | config (env), security (scrypt password hashing, JWT, rate limiter), dependencies (auth, PayPal/LLM clients), errors |
| `database/` | engine/session, `init_db` (SQLite fallback, PostgreSQL via `DATABASE_URL`) |
| `models/` | users, profiles, customers, invoices, invoice items, payments, transactions, AI conversations/messages/pending actions, notifications, webhook events, audit logs |
| `schemas/` | Pydantic request validation |
| `routes/` | thin REST routers: auth, customers, payments, invoices, analytics, safety, assistant, notifications, demo, webhooks, system |
| `services/` | business logic (kept free of web-framework imports where possible so it is unit-testable) |

Key services: `paypal_client` (OAuth, orders, capture, webhook verification, invoicing), `payments_service` (workflow + status verification),
`assistant_service` + `assistant_tools` (tool calling), `command_parser` (demo assistant), `safety`, `analytics`, `invoice_pdf`, `webhook_service`, `demo_data`.

## Safety design (money-moving rules)
1. **The AI cannot move money.** Its tools are read-only or `prepare_*` which only save a `PendingAction` draft. Execution happens only through `POST /assistant/actions/{id}/confirm`, called by the user's button press.
2. **PayPal is the source of truth.** A payment becomes `COMPLETED` only after the backend reads the order/capture from PayPal and the amount + currency match. Frontend messages are never trusted. Amount mismatches mark the payment `FAILED` (not paid) and notify the user.
3. **Idempotency.** Payment creation is unique per `(user, idempotency_key)`; PayPal calls send `PayPal-Request-Id`; assistant actions can be confirmed once; webhook events are unique by PayPal event id.
4. **Explicit confirmation** (`confirm: true`) is required to create or capture; the UI shows a confirmation dialog first. Refunds are not implemented.
5. **Webhooks** are verified via PayPal's `verify-webhook-signature`; invalid signatures are rejected (400), duplicates ignored, and the payment is re-read from PayPal before updating.
6. **Demo mode:** without PayPal credentials, records are flagged `is_demo` and never contact PayPal. The UI labels all demo data **DEMO DATA**.
7. **Authorization:** every query is scoped to the signed-in user; other users' ids return 404.
8. **Safety alerts are advisory** (duplicates, outliers, rapid repeats, failure streaks) and never block a payment.

## Frontend layout (`frontend/src`)
`pages/` (one per route), `components/` (shared UI), `layouts/AppLayout` (sidebar + mobile tab bar), `context/` (auth, language, system status, toasts, notifications),
`services/api.js` (single API wrapper; base URL from `VITE_API_URL`), `i18n/` (English, Tamil, Hindi), `hooks/` (speech recognition, fetch, format).
