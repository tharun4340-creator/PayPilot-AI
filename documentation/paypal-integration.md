# PayPal Integration Guide

## 1. Get Sandbox credentials
1. Create a developer account at https://developer.paypal.com and open **Dashboard → Apps & Credentials**, mode **Sandbox**.
2. **Create App** → copy the **Client ID** and **Secret** into `.env` (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`). Keep `PAYPAL_ENV=sandbox`.
3. Under **Sandbox → Accounts**, use the default *Personal* (buyer) account to approve test payments. Its email/password are shown in the dashboard.
4. (Webhooks) In your app, **Add Webhook** with URL `https://<public-host>/api/v1/webhooks/paypal` and events `CHECKOUT.ORDER.APPROVED`, `CHECKOUT.ORDER.COMPLETED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.REFUNDED`. Copy the **Webhook ID** into `PAYPAL_WEBHOOK_ID`. For local testing expose the backend with a tunnel (e.g. ngrok); PayPal cannot call `localhost`.

## 2. Payment flow
1. User confirms a payment request → backend `POST /v2/checkout/orders` (intent `CAPTURE`) → stores order id and the `payer-action` approval URL.
2. The customer (or you, as the sandbox buyer) opens the approval link and approves. PayPal redirects to `{FRONTEND_URL}/payments/return?token=<ORDER_ID>`.
3. The return page asks the backend to verify with PayPal (`GET /v2/checkout/orders/{id}`); status `APPROVED` shows a **Capture** button.
4. User confirms capture → backend `POST /v2/checkout/orders/{id}/capture`, then **re-reads the order** and only then marks `COMPLETED`.
5. The webhook (if configured) also updates the payment, after signature verification.

## 3. Invoicing API
`create_paypal_invoice` creates a **draft** via `POST /v2/invoicing/invoices`; sending uses `/send` after explicit confirmation. Invoicing may be unavailable for some accounts/regions or sandbox setups. If PayPal rejects the call, PayPilot creates the **local invoice anyway**, shows a warning explaining why, and the local invoice can still be paid through Checkout. Local PDF download always works.

## 4. Known limitations (honest notes)
- Currency/country support varies per PayPal account. PayPilot passes the currency you choose and shows PayPal's error in plain language (e.g. unsupported currency). **USD is the safest sandbox default.** Indian-rupee (INR) business accounts have restrictions on some account types.
- Refunds, transaction-history sync (Transaction Search API) and payouts are **not implemented**. Payment history shows payments created through PayPilot.
- "Payments sent" is shown as *Not available* because PayPilot only creates incoming payment requests.
- Rate limiting is in-memory (single process). Use a shared store (e.g. Redis) when running several instances.
- Webhook verification calls PayPal's verify endpoint, so the backend needs outbound access to PayPal.

## 5. Going Live (only after Sandbox testing)
1. Complete PayPal business-account verification and confirm your account can receive payments in your currency.
2. Create a **Live** app, then set `PAYPAL_ENV=live`, live `PAYPAL_CLIENT_ID/SECRET`, a new live webhook id, `APP_ENV=production`, a strong `SECRET_KEY`, HTTPS, and your real `FRONTEND_URL` / `CORS_ORIGINS`.
3. Switch to PostgreSQL, set `AUTO_CREATE_TABLES=false` and run `alembic upgrade head` (generate the first migration with `alembic revision --autogenerate -m init`).
4. Test one small real payment end to end before going public. The app shows a red **Live** badge in Settings when live mode is active.
