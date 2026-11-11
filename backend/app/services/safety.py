"""Advisory payment-safety indicators. These are heuristics, NOT fraud detection, and nothing is ever blocked."""
from __future__ import annotations

from datetime import datetime, timedelta
from statistics import median

NOTE = " This is an indicator to review, not proof of a problem."
INACTIVE = ("FAILED", "CANCELLED")


def _same(a: str, b: str) -> bool:
    return (a or "").strip().lower() == (b or "").strip().lower()


def is_outlier(amount: float, history: list) -> bool:
    """Robust outlier test (median / MAD). Needs at least 5 samples."""
    if len(history) < 5:
        return False
    med = median(history)
    if med <= 0:
        return False
    mad = median([abs(x - med) for x in history])
    if mad == 0:
        return amount >= 5 * med
    return 0.6745 * (amount - med) / mad > 3.5 and amount >= 2 * med


def check_new_payment(history: list, customer_name: str, amount: float, currency: str, now: datetime) -> list:
    out = []
    active = [r for r in history if r["status"] not in INACTIVE and r["currency"] == currency]
    for r in active:
        if _same(r["customer_name"], customer_name) and abs(r["amount"] - amount) < 0.005 and now - r["created_at"] <= timedelta(hours=24):
            out.append({"type": "duplicate_payment", "severity": "warning", "title": "Possible duplicate payment",
                        "explanation": f"A payment of the same amount for {customer_name} was created in the last 24 hours (payment #{r['id']})." + NOTE})
            break
    amounts = [r["amount"] for r in active]
    if is_outlier(amount, amounts):
        out.append({"type": "unusual_amount", "severity": "warning", "title": "Unusually large amount",
                    "explanation": f"This amount is much higher than your typical payments (median about {median(amounts):,.2f})." + NOTE})
    elif len(amounts) >= 5 and not any(_same(r["customer_name"], customer_name) for r in active) and amount >= 3 * median(amounts):
        out.append({"type": "new_customer_large", "severity": "info", "title": "Large amount for a new customer",
                    "explanation": f"{customer_name} has no payment history and this amount is well above your usual." + NOTE})
    return out


def detect_alerts(rows: list, now: datetime) -> list:
    alerts = []
    rows = sorted(rows, key=lambda r: r["created_at"])
    active = [r for r in rows if r["status"] not in INACTIVE]
    seen = set()
    # duplicates: same customer + amount + currency within 24h
    for i, a in enumerate(active):
        for b in active[i + 1:]:
            if _same(a["customer_name"], b["customer_name"]) and a["currency"] == b["currency"] and abs(a["amount"] - b["amount"]) < 0.005 \
                    and b["created_at"] - a["created_at"] <= timedelta(hours=24):
                key = f"duplicate_payment:{a['id']}-{b['id']}"
                if key not in seen:
                    seen.add(key)
                    alerts.append({"id": key, "type": "duplicate_payment", "severity": "warning", "title": "Possible duplicate payment",
                                   "explanation": f"Payments #{a['id']} and #{b['id']} for {a['customer_name']} have the same amount within 24 hours." + NOTE,
                                   "payment_ids": [a["id"], b["id"]], "created_at": b["created_at"]})
    # rapid repeats: 3+ in one hour for the same customer
    by_cust: dict = {}
    for r in active:
        by_cust.setdefault(r["customer_name"].strip().lower(), []).append(r)
    for name, items in by_cust.items():
        for i in range(len(items) - 2):
            if items[i + 2]["created_at"] - items[i]["created_at"] <= timedelta(hours=1):
                ids = [x["id"] for x in items[i:i + 3]]
                alerts.append({"id": "rapid_repeat:" + "-".join(map(str, ids)), "type": "rapid_repeat", "severity": "info",
                               "title": "Several payments in a short time",
                               "explanation": f"{items[i]['customer_name']} has 3 or more payment requests within an hour." + NOTE,
                               "payment_ids": ids, "created_at": items[i + 2]["created_at"]})
                break
    # unusual amounts (per currency)
    for cur in {r["currency"] for r in active}:
        pool = [r for r in active if r["currency"] == cur]
        amounts = [r["amount"] for r in pool]
        for r in pool:
            if is_outlier(r["amount"], amounts):
                alerts.append({"id": f"unusual_amount:{r['id']}", "type": "unusual_amount", "severity": "warning", "title": "Unusually large amount",
                               "explanation": f"Payment #{r['id']} ({r['amount']:,.2f} {cur}) is far above your typical payment size." + NOTE,
                               "payment_ids": [r["id"]], "created_at": r["created_at"]})
    # failed streak in last 7 days
    failed = [r for r in rows if r["status"] in INACTIVE and now - r["created_at"] <= timedelta(days=7)]
    if len(failed) >= 3:
        ids = [r["id"] for r in failed]
        alerts.append({"id": "failed_streak:" + "-".join(map(str, ids)), "type": "failed_streak", "severity": "warning",
                       "title": "Several failed or cancelled payments", "explanation": f"{len(failed)} payments failed or were cancelled in the last 7 days." + NOTE,
                       "payment_ids": ids, "created_at": max(r["created_at"] for r in failed)})
    return sorted(alerts, key=lambda a: a["created_at"], reverse=True)
