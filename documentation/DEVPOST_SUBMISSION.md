# Devpost submission draft

Copy and adapt these sections in the PayPal AI Hackathon submission form. Keep claims aligned with the version you actually record and publish.

## Project name

PayPilot AI

## Tagline

An income continuity copilot for freelancers.

## Short description

PayPilot helps independent earners plan around late payments. It brings PayPal payment activity together with an Income Shock Lens that tests a freelancer's own cash reserve against essential expenses. Its AI assistant can look up payment records and prepare a PayPal payment request for the user to review. A person confirms every money-related action, and PayPal remains the source of truth for payment status.

## Problem

Freelancers often finish the work before they receive the money. When a client pays late, it is hard to see which requests are still outstanding and how long current reserves can cover essentials. Pending invoices can look reassuring in a dashboard even though that money is not available to spend.

## Solution

PayPilot combines payment follow-up with a simple cash-flow stress test. A freelancer can review customer and payment history, enter their own reserve and essential monthly costs, and see how a delay changes their estimated coverage. The AI copilot can answer questions using scoped payment tools and prepare a payment request. It cannot send money or complete a payment on its own: the user reviews and confirms the action, and PayPal handles the payment flow.

## What is distinctive

The central interaction connects an income-delay scenario to a safe next step. The Income Shock Lens does not count unpaid requests as cash. If a user wants to act, the AI can prepare a payment request from account data, show the details and warnings, and wait for explicit confirmation before the PayPal integration is used. The goal is to help a freelancer decide what to follow up on while keeping financial decisions with the person.

## Features

- Income Shock Lens using the user's own reserve and essential-cost inputs.
- Payment, invoice and customer history with follow-up reminders and advisory risk signals.
- Gemini function calling for scoped payment lookups and preparation of user-reviewed payment requests or invoices.
- PayPal Orders v2 checkout, approval and capture flow, with PayPal status verification; optional Invoicing v2 and webhook verification are also implemented.
- A clearly labeled demo mode for exploring the product without payment credentials.
- UPI QR and PayPal seller checkout handoffs. These open the user's chosen payment app or PayPal; PayPilot does not collect a UPI PIN, read a bank balance, or claim to verify those external handoffs.

## How we built it

The interface is built with React and Vite. A FastAPI backend scopes records to the signed-in user and connects the app to PayPal Orders v2 and Gemini function calling. The model receives only the context needed for a request and can call a limited set of payment-data and draft-preparation tools. Payment actions require user confirmation; PayPal verifies the payment result. API keys stay in backend environment variables.

## Tools and technologies

- PayPal Developer Platform: Sandbox Orders v2, with optional Invoicing v2 and webhooks.
- Google Gemini API: model-backed function calling for payment questions and draft preparation.
- React, Vite, Tailwind CSS, FastAPI, SQLAlchemy, and SQLite/PostgreSQL.

## Demo and testing notes

Use the public demo URL if one is available. Otherwise, the repository's README contains full local setup instructions. In the app, select **Try the interactive demo** to create a fresh account with labeled sample records. For a real PayPal Sandbox walkthrough, configure Sandbox Client ID and Secret on the backend and keep `PAYPAL_ENV=sandbox`. Without those credentials, checkout remains in labeled Demo mode. Never put API secrets in the frontend or public repository.

The UPI feature creates a payment intent and QR for the user's UPI app; approval and payment status are handled externally. The Wallet page does not provide live bank linking or bank balances. Gemini free-tier prompts may be used by Google to improve its products, so use the labeled sample data in the demo.

## 2:30 video outline

Record the actual running app and keep the uploaded video under three minutes. Use your own narration and no copyrighted music.

| Time | Show | Narration |
| --- | --- | --- |
| 0:00–0:15 | Landing page and demo entry | “Freelancers can finish the work long before a client pays. PayPilot helps them understand the gap and decide what to follow up on.” |
| 0:15–0:45 | Dashboard and Income Shock Lens | “This view uses the reserve and essential costs the user enters. Pending invoices are not counted as available cash, so the scenario stays grounded.” |
| 0:45–1:15 | Assistant answering a payment-history question | “The assistant uses scoped tools to look up this account’s payment records. If the model key is unavailable, the app labels its demo assistant clearly.” |
| 1:15–1:50 | Ask it to prepare a payment request; inspect draft and confirm | “The model prepares the details, but it does not send money. The user checks the amount and recipient and chooses whether to continue.” |
| 1:50–2:15 | PayPal Sandbox order and approval/result, if Sandbox is configured | “The app creates a Sandbox order, hands approval to PayPal, and uses PayPal’s response for the result.” Do not describe Demo mode as a real PayPal transaction. |
| 2:15–2:30 | Return to the payment record / closing | “PayPilot connects payment follow-up with income planning while leaving the financial decision with the freelancer.” |

## Before submitting

- Test and record the PayPal Sandbox flow if claiming it in the video.
- Publish the source repository publicly and make the MIT license visible on the repository page.
- Upload the working demo video to YouTube with public visibility and add its URL to Devpost.
- Add the repository URL, demo URL or complete run instructions, tools used, and this feature description to Devpost.
- Explain any significant changes made during the hackathon period; do not imply that older work was built during the event.
- Confirm the Devpost entry is submitted before the deadline shown on the official event page.
