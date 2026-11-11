# PayPilot AI

**The income continuity copilot for freelancers.** PayPilot brings PayPal payment requests, invoices and customer history together with an interactive way to stress-test a late payment. Its AI can look up payment records and prepare a PayPal request for a human to review.

> **Every money action stays with the person.** The assistant can prepare a draft. It cannot capture, transfer or send money without the user's explicit confirmation. PayPal is the source of truth for payment status. Demo records are always labeled and never contact PayPal.

## Why PayPilot

Independent earners often have no predictable payday. PayPilot is built for the gap between finishing work and receiving payment:

- **Income Shock Lens:** enter your own reserve and essential monthly costs, then see how many weeks that buffer covers. Unpaid requests never count as cash. Inputs stay in the browser.
- **PayPal payments:** create an order, open its PayPal approval link, capture after payer approval, and verify the outcome against PayPal.
- **Pay anyone with UPI:** create an INR UPI intent and a locally generated QR for any UPI ID. The payer approves in their chosen UPI app; PayPilot never handles the UPI PIN and cannot verify the payment result.
- **Pay a seller:** paste a seller's PayPal invoice or payment link, review the PayPal destination, then finish checkout using your own PayPal account. This buyer flow is separate from merchant payment requests and does not store the link.
- **AI payment copilot:** ask questions about payment history or prepare a payment request/invoice with tool calling. Review the details, warnings and amount before confirming.
- **Trust signals:** advisory duplicate and outlier checks, invoice reminders, payment history, and a clear demo / Sandbox environment banner.
- **A judge-ready entry point:** **Try the interactive demo** creates a fresh visitor account and loads labeled sample records; no shared demo password is required.
- **Built for real users:** invoices with PDF download, customer records, reports, notifications, voice input, and English, Tamil and Hindi interfaces.

The Income Shock Lens is a user-entered scenario, not a cash balance or income prediction. Safety signals are heuristics, not guaranteed fraud detection.

The Wallet page does not claim to link a bank or read a live balance. In India, live account data requires a consent-based Account Aggregator connection and FIU onboarding; UPI transfers are authorized in the user's UPI app. The UPI QR is generated on-device and is not sent to the backend.

## PayPal AI Hackathon

The project meaningfully uses both PayPal and AI: PayPal Orders v2, optional Invoicing v2 and webhook verification connect the payment flow; the assistant calls scoped data and draft-preparation tools, then requires confirmation before a PayPal request is created. A free-tier Gemini option is included for model-backed tool calling. Demo mode still works without any API keys and labels its deterministic fallback.

See the [Devpost submission draft](documentation/DEVPOST_SUBMISSION.md) and [judge walkthrough, pitch and setup notes](documentation/HACKATHON.md).

## Stack

- Frontend: React 18, Vite, Tailwind, Recharts, Lucide, React Router
- Backend: FastAPI, SQLAlchemy, Pydantic, Alembic, SQLite or PostgreSQL
- Payments: PayPal Orders v2, Invoicing v2 and webhooks
- AI: Gemini function calling or the existing Anthropic / OpenAI-compatible / Meta providers

## Run locally

Requirements: Python 3.10+, Node.js 20+, npm.

### 1. Configure the backend

From the project root, copy `.env.example` to `.env`. For Demo mode, leave PayPal credentials empty. To enable model-backed tool calling, create a free Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey) and set `LLM_API_KEY` in `.env`. `LLM_PROVIDER=google` and `LLM_MODEL=gemini-3.8-flash` are already set in the example. The model key is read by the backend only. Google's Gemini free tier may use submitted prompts to improve its products; PayPilot sends the customer/payment context needed for answers. Use the labeled demo records when trying this provider.

To exercise PayPal end to end, create a PayPal Sandbox app and set its Client ID and Secret in the same `.env` file. Keep `PAYPAL_ENV=sandbox`.

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API health endpoint is http://localhost:8000/health and interactive API docs are at http://localhost:8000/docs.

### 2. Start the frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and select **Try the interactive demo**, or create a normal account. If the server is in Demo mode, every simulated record is labeled. With PayPal Sandbox credentials, confirmed requests create Sandbox orders; this never uses real money.

## Publish a free judge demo

The root `render.yaml` and `Dockerfile` package the frontend and backend as one service. Push the repository to GitHub, choose **New Blueprint** in Render, connect the repository and select its Free plan. Render builds the app and gives it one HTTPS URL. Add the Gemini and PayPal Sandbox credentials as Render environment variables after deployment; without them the app still opens in clearly labeled Demo mode.

The free Render service sleeps after 15 minutes without traffic, and its local SQLite file is temporary. A fresh start can take about a minute and clears demo accounts. Judges can select **Try the interactive demo** again to create a new account and sample data. This deployment is intended for hackathon evaluation, not for storing real business records. [Render free service limitations](https://render.com/docs/free).

## Suggested demo

1. From the landing page, select **Try the interactive demo**.
2. On the dashboard, adjust the reserve and essential-cost values in the Income Shock Lens. Point out that the simulation excludes pending payments.
3. Open **Assistant** and ask: `Show my pending payments.` Then ask: `Create a payment request for Maya Patel for 180 USD for an accessibility audit.`
4. Review the generated draft and confirm it. With only demo settings, it creates a labeled demo record. With PayPal Sandbox configured, it creates a Sandbox approval link.
5. Explain the boundary: PayPilot prepares the request, the user confirms it, and PayPal verifies any completed payment.

## Security and configuration

- Passwords use scrypt hashing; sessions use signed bearer tokens.
- Database reads are scoped to the signed-in user.
- PayPal and AI credentials remain in backend environment variables.
- No card numbers are stored by PayPilot.
- Demo data is separately flagged and can be removed in Settings.
- The app is independent and is not affiliated with or endorsed by PayPal.

## Project layout

```text
backend/        FastAPI, payment and AI services, migrations, tests
frontend/       React app, routes, components, translations
documentation/  API docs, integration notes, hackathon pitch and demo script
```

## License

MIT. See [LICENSE](LICENSE).
