"""Deterministic command parser used by the demo assistant (no AI model involved)."""
from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Optional

CURRENCY_WORDS = {
    "₹": "INR", "rs": "INR", "inr": "INR", "rupee": "INR", "rupees": "INR", "ரூபாய்": "INR", "रुपये": "INR", "रुपया": "INR",
    "$": "USD", "usd": "USD", "dollar": "USD", "dollars": "USD",
    "€": "EUR", "eur": "EUR", "euro": "EUR", "euros": "EUR",
    "£": "GBP", "gbp": "GBP", "pound": "GBP", "pounds": "GBP",
}

AMOUNT_RE = re.compile(
    r"(?P<pre>₹|\$|€|£|\brs\.?|\binr|\busd|\beur|\bgbp)?\s*(?P<num>\d[\d,]*(?:\.\d+)?)\s*"
    r"(?P<post>rupees?\b|rs\b|inr\b|usd\b|dollars?\b|euros?\b|eur\b|pounds?\b|gbp\b|रुपये|रुपया|ரூபாய்)?",
    re.IGNORECASE,
)
LEAD_RE = re.compile(
    r"^\s*(?:(?:please|can you|could you|kindly)\s+)*(?:create|make|generate|send|raise|prepare|draft|new|request|bill|charge|collect)\s+"
    r"(?:me\s+)?(?:a\s+|an\s+|the\s+)?(?:new\s+)?(?:payment\s+request|payment|invoice|bill|request)?\s*(?:for|to|from)?\s*",
    re.IGNORECASE,
)
TRAIL_RE = re.compile(r"[\s,:\-]*(?:\b(?:for|of|worth|amounting(?:\s+to)?|amount(?:\s+of)?|at)\b[\s,:\-]*)*$", re.IGNORECASE)
GENERIC_NAMES = {"a customer", "customer", "someone", "a client", "client", "my customer", "my client", "a person"}


def _amount(text: str):
    matches = list(AMOUNT_RE.finditer(text))
    if not matches:
        return None
    chosen = next((m for m in matches if m.group("pre") or m.group("post")), matches[0])
    word = (chosen.group("pre") or chosen.group("post") or "").lower().rstrip(".")
    try:
        value = Decimal(chosen.group("num").replace(",", ""))
    except InvalidOperation:
        return None
    return value, CURRENCY_WORDS.get(word) if word else None, chosen.start(), chosen.end()


def detect_intent(text: str) -> str:
    low = text.lower()
    has_invoice = re.search(r"invoice|चालान|விலைப்பட்டியல்", low)
    create_verb = re.search(r"\b(create|make|generate|new|raise|prepare|draft|send)\b|बनाओ|बनाएं|बनाइए|உருவாக்கு|உருவாக்க", low)
    if has_invoice and create_verb:
        return "invoice"
    if re.search(r"payment request|request (a )?payment|payment link|\bcharge\b|\bbill\b|\bcollect\b|भुगतान अनुरोध|கட்டண கோரிக்கை", low) and (
        create_verb or re.search(r"\b(request|charge|bill|collect)\b", low)
    ):
        return "payment_request"
    if re.search(r"why.*(fail|declin|reject)|explain.*fail|fail(ed)?\b|विफल|தோல்வி", low):
        return "explain_failure"
    if re.search(r"pending|outstanding|unpaid|awaiting|लंबित|बकाया|நிலுவை", low):
        return "pending_payments"
    if re.search(r"top customers?|best customers?|biggest customers?|शीर्ष ग्राहक|சிறந்த வாடிக்கையாளர்", low):
        return "top_customers"
    if re.search(r"report|रिपोर्ट|அறிக்கை", low):
        return "monthly_report"
    if re.search(r"summar|overview|how much|सारांश|சுருக்கம்", low):
        return "month_summary"
    if re.search(r"recent|latest|\blast\b|show.*(payments|transactions)|my payments|हाल|சமீபத்திய", low):
        return "recent_payments"
    if re.search(r"\bhelp\b|what can you do|मदद|உதவி", low):
        return "help"
    return "unknown"


def _clean_name(raw: str) -> Optional[str]:
    name = TRAIL_RE.sub("", raw or "").strip(" .,'\"")
    if not name or name.lower() in GENERIC_NAMES or name[0].isdigit() or len(name) > 60 or len(name.split()) > 5:
        return None
    return name.title() if name == name.lower() else name


def parse_command(text: str) -> dict:
    text = (text or "").strip()
    intent = detect_intent(text)
    result = {
        "intent": intent, "customer_name": None, "amount": None, "currency": None, "description": None, "missing": [],
        "month": "last" if re.search(r"last month|पिछले महीने|கடந்த மாதம்", text.lower()) else "this",
    }
    if intent not in ("invoice", "payment_request"):
        return result
    amt = _amount(text)
    if amt:
        value, currency, start, end = amt
        result["amount"], result["currency"] = value, currency
        result["customer_name"] = _clean_name(LEAD_RE.sub("", text[:start], count=1))
        desc = re.sub(r"^[\s,.:;\-]*(?:(?:for|of|towards|regarding|as|on|being)\b)?\s*", "", text[end:], flags=re.IGNORECASE)
        desc = desc.strip(" .!?,;")
        result["description"] = desc or None
    else:
        rest = LEAD_RE.sub("", text, count=1)
        parts = re.split(r"\s+for\s+", rest, maxsplit=1, flags=re.IGNORECASE)
        result["customer_name"] = _clean_name(parts[0])
        if len(parts) > 1:
            result["description"] = parts[1].strip(" .!?,;") or None
    for field in ("customer_name", "amount", "description"):
        if not result[field]:
            result["missing"].append(field)
    return result
