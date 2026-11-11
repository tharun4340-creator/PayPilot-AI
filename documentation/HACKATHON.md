# PayPilot — Paycheck uncertainty, meet your copilot

## The idea

Freelancers do not get a predictable payday. One late invoice can turn a normal month into a stressful one. PayPilot combines the part freelancers can see (PayPal payment requests, invoices and client payment history) with the part they need to plan (a cash buffer and essential costs they enter themselves).

The **Income Shock Lens** stress-tests that buffer without pretending pending payments are cash or claiming to predict the future. The **PayPilot AI** assistant can inspect the account's payment data and prepare a payment request or invoice through a tool call. A person reviews and confirms each money-related action; PayPal remains the source of truth for payment status.

## Three-minute judge walkthrough

1. Open the landing page and select **Try the interactive demo**. It creates a fresh visitor account and seeds clearly labeled sample records.
2. On the dashboard, adjust the reserve and essential-cost sliders. Show how coverage changes, then point out the largest-customer share and pending amount. Explain that the slider inputs stay in that browser and unpaid requests do not count as cash.
3. Open **Assistant** and ask: `Who is waiting on a payment, and what should I follow up on?` The model can inspect the records with PayPilot tools. If no model key is configured, the interface labels the deterministic demo assistant.
4. Ask: `Create a payment request for Maya Patel for 180 USD for an accessibility audit.` Inspect the prepared customer, amount, purpose and any safety warnings. Show that the assistant has only prepared a draft.
5. Select **Confirm**. In demo mode it saves a labeled sample record and moves no money. With PayPal Sandbox credentials, the backend creates a PayPal Sandbox order and returns its approval link. Only PayPal verification can mark a real Sandbox payment as completed.

## Submission checklist

The official [PayPal AI Hackathon rules](https://paypalaihackathon.devpost.com/rules) require a working project with PayPal Sandbox and AI at its core, a public source repository with an open-source license, and a functional demo judges can run or open. The submission also needs a public YouTube demo video under three minutes. This repository includes the source, MIT license, run instructions, a judge walkthrough and a short pitch; the remaining submission artifacts must be attached to the Devpost entry.

- Publish this project as a public GitHub, GitLab or Bitbucket repository and make the MIT license visible.
- Provide a working demo URL or complete setup instructions. The free Render path is documented below; the local setup also works.
- Record and publish a YouTube video under three minutes that shows the working demo, the user-confirmed action flow and the PayPal Sandbox result. Avoid unlicensed music or third-party marks in the video.
- Keep the demo available and free for judges during evaluation. Explain that Gemini free-tier prompts may be used by Google to improve its products; use the labeled sample account for the recording.

## Pitch (about 90 seconds)

> A freelancer can do great work and still have no idea whether next month's bills are covered. Their payment requests live in one place, invoices in another, and the plan for a late client lives in their head.
>
> PayPilot is an income continuity copilot for independent earners. It brings PayPal requests, invoices and customer payment history into one place, then lets the freelancer stress-test a late payment against their own reserve and essential costs. It never counts an unpaid invoice as available cash.
>
> The AI can look up the user's real payment records and prepare a follow-up request or invoice using PayPilot tools. Before any action reaches PayPal, the person reviews the details and confirms. PayPal confirms the outcome.
>
> We built the product around the messy part of self-employment: the uncertain space between doing the work and getting paid.

## Technical and impact notes

- **PayPal:** Orders v2 checkout, optional PayPal Invoicing v2, status verification and webhook signature handling. Use Sandbox credentials for the live integration demo; no production credentials are needed.
- **UPI buyer handoff:** the Wallet page creates a `upi://pay` handoff and local QR for a recipient VPA. The payer finishes approval in their own UPI app; this app does not collect a UPI PIN or claim transaction status.
- **Bank data boundary:** the Wallet page does not fabricate linked accounts or balances. India bank data sharing requires customer consent through the Account Aggregator framework and approved FIU onboarding; the current build has no live bank-data provider.
- **Buyer checkout handoff:** the separate **Pay a seller** page accepts secure PayPal invoice, payment-link and PayPal.Me URLs, then hands the payer to PayPal to sign in and approve with their own account. It does not use the app's merchant credentials or claim to verify outgoing payments.
- **AI:** Gemini function calling is available through the Google AI Studio free tier. Model and API key remain on the backend. A deterministic fallback keeps the app usable without a key and is visibly labeled.
- **Data handling:** Google's Gemini API free tier may use submitted prompts to improve Google products. PayPilot sends the context required to answer, which can include payment and customer details. The app surfaces this notice in Settings; use the labeled demo records for the hackathon demonstration.
- **Human control:** AI-created payment requests and invoices are pending actions. They require an explicit confirmation. The model cannot capture or transfer money.
- **Audience:** freelancers, solo service businesses and microbusiness owners who invoice clients and face uneven cash collection.
- **Evidence limits:** the Income Shock Lens is a user-entered scenario. The safety signals are heuristics. Neither one predicts income, connects to a bank account, or guarantees fraud detection.

## Free setup for a judge

1. Copy `.env.example` to `.env` in the repository root.
2. To use model-backed function calling, create a free API key in [Google AI Studio](https://aistudio.google.com/apikey), put it in `LLM_API_KEY`, and leave `LLM_PROVIDER=google` and `LLM_MODEL=gemini-3.8-flash`.
3. To create actual Sandbox payment orders, add a PayPal Sandbox Client ID and Secret. Without them, the app stays in Demo mode and clearly identifies simulated payment records.
4. Start the FastAPI backend and React frontend as described in the root README. Open the frontend and use **Try the interactive demo**.

For a hosted judge URL, publish the repository and create a Render Blueprint from `render.yaml`. The free web service sleeps after 15 idle minutes; its SQLite data is temporary and can reset when it restarts. The landing-page demo button creates a fresh visitor account and sample data after each reset. The first request after an idle period can take about a minute.

No Gemini or PayPal secret belongs in the frontend or source control.
