"""Pure analytics over payment rows: dicts with id, customer_name, amount, currency, status, description, created_at, completed_at."""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import datetime
from statistics import mean

PENDING = ("CREATED", "APPROVED")
FAILED = ("FAILED", "CANCELLED")
CATEGORY_KEYWORDS = {
    "Subscriptions & Retainers": ["retainer", "subscription", "monthly", "maintenance", "membership"],
    "Design": ["design", "logo", "ui", "ux", "brand", "graphic", "poster", "figma"],
    "Development": ["website", "web", "app", "apps", "develop", "code", "software", "api", "bug", "hosting"],
    "Writing & Content": ["writing", "article", "blog", "content", "copy", "edit", "translation", "video"],
    "Consulting": ["consult", "advice", "session", "coaching", "training", "tutor", "class"],
    "Marketing": ["marketing", "seo", "ads", "campaign", "social"],
    "Products": ["product", "order", "item", "shipment", "goods", "stock"],
}


def month_key(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


def effective_date(row: dict) -> datetime:
    return row.get("completed_at") or row["created_at"]


def categorize(description: str) -> str:
    words = re.findall(r"[a-z]+", (description or "").lower())
    for cat, keys in CATEGORY_KEYWORDS.items():
        if any(w == k or (len(k) >= 4 and w.startswith(k)) for w in words for k in keys):
            return cat
    return "Other"


def primary_currency(rows: list, default: str) -> str:
    done = [r["currency"] for r in rows if r["status"] == "COMPLETED"] or [r["currency"] for r in rows]
    return Counter(done).most_common(1)[0][0] if done else default


def totals(rows: list, currency: str) -> dict:
    mine = [r for r in rows if r["currency"] == currency]
    return {
        "currency": currency, "sent": None,
        "received": round(sum(r["amount"] for r in mine if r["status"] == "COMPLETED"), 2),
        "pending_amount": round(sum(r["amount"] for r in mine if r["status"] in PENDING), 2),
        "pending_count": sum(1 for r in mine if r["status"] in PENDING),
        "completed_count": sum(1 for r in mine if r["status"] == "COMPLETED"),
        "failed_count": sum(1 for r in mine if r["status"] in FAILED),
        "excluded_other_currency_count": len(rows) - len(mine),
    }


def monthly_series(rows: list, months: int, now: datetime, currency: str) -> list:
    keys, y, m = [], now.year, now.month
    for _ in range(months):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    keys.reverse()
    acc = {k: [0.0, 0] for k in keys}
    for r in rows:
        if r["status"] == "COMPLETED" and r["currency"] == currency:
            k = month_key(effective_date(r))
            if k in acc:
                acc[k][0] += r["amount"]
                acc[k][1] += 1
    return [{"month": k, "received": round(v[0], 2), "count": v[1]} for k, v in acc.items()]


def top_customers(rows: list, currency: str, limit: int = 5) -> list:
    acc: dict = defaultdict(lambda: [0.0, 0])
    for r in rows:
        if r["status"] == "COMPLETED" and r["currency"] == currency:
            acc[r["customer_name"]][0] += r["amount"]
            acc[r["customer_name"]][1] += 1
    ranked = sorted(acc.items(), key=lambda kv: kv[1][0], reverse=True)[:limit]
    return [{"name": n, "total": round(v[0], 2), "count": v[1]} for n, v in ranked]


def category_breakdown(rows: list, currency: str) -> list:
    acc: dict = defaultdict(lambda: [0.0, 0])
    for r in rows:
        if r["status"] == "COMPLETED" and r["currency"] == currency:
            c = categorize(r.get("description", ""))
            acc[c][0] += r["amount"]
            acc[c][1] += 1
    return [{"category": c, "total": round(v[0], 2), "count": v[1]} for c, v in sorted(acc.items(), key=lambda kv: kv[1][0], reverse=True)]


def customer_patterns(rows: list, currency: str) -> list:
    groups: dict = defaultdict(list)
    for r in rows:
        if r["currency"] == currency:
            groups[r["customer_name"]].append(r)
    out = []
    for name, items in groups.items():
        done = [r for r in items if r["status"] == "COMPLETED"]
        out.append({
            "name": name, "count": len(done), "total": round(sum(r["amount"] for r in done), 2),
            "average": round(mean(r["amount"] for r in done), 2) if done else 0.0,
            "last_payment": max((effective_date(r) for r in done), default=None),
            "pending_count": sum(1 for r in items if r["status"] in PENDING),
        })
    return sorted(out, key=lambda p: p["total"], reverse=True)


def build_insights(rows: list, now: datetime, currency: str) -> list:
    if not rows:
        return [{"title": "No data yet", "body": "Create a payment request or load demo data to see insights here.", "kind": "info"}]
    out, t = [], totals(rows, currency)
    series = monthly_series(rows, 2, now, currency)
    prev, cur = series[0]["received"], series[1]["received"]
    if prev > 0:
        change = (cur - prev) / prev * 100
        out.append({"title": f"Received {'up' if change >= 0 else 'down'} {abs(change):.0f}% vs last month",
                    "body": f"{cur:,.2f} {currency} so far this month vs {prev:,.2f} last month. This describes past payments only; it is not a forecast.",
                    "kind": "positive" if change >= 0 else "caution"})
    elif cur > 0:
        out.append({"title": "Payments received this month", "body": f"{cur:,.2f} {currency} received so far this month.", "kind": "info"})
    if t["pending_count"]:
        oldest = min((r["created_at"] for r in rows if r["status"] in PENDING and r["currency"] == currency), default=now)
        days = (now - oldest).days
        out.append({"title": f"{t['pending_count']} payment(s) waiting", "body": f"{t['pending_amount']:,.2f} {currency} is not yet paid. The oldest has been waiting {days} day(s).",
                    "kind": "caution" if days > 7 else "info"})
    tops = top_customers(rows, currency, 1)
    if tops and t["received"] > 0 and t["completed_count"] >= 3 and tops[0]["total"] / t["received"] >= 0.5:
        out.append({"title": "Revenue depends on one customer", "body": f"{tops[0]['name']} accounts for {tops[0]['total'] / t['received'] * 100:.0f}% of what you have received.", "kind": "caution"})
    recent_failed = [r for r in rows if r["status"] in FAILED and (now - r["created_at"]).days <= 30]
    if recent_failed:
        out.append({"title": f"{len(recent_failed)} failed or cancelled in 30 days", "body": "Open the Safety page to see why and what to try.", "kind": "caution"})
    return out[:5]


def rule_based_summary(rows: list, now: datetime, currency: str) -> str:
    if not rows:
        return "There is no payment data to summarise yet."
    t = totals(rows, currency)
    tops = top_customers(rows, currency, 1)
    text = (f"You have received {t['received']:,.2f} {currency} from {t['completed_count']} completed payment(s). "
            f"{t['pending_count']} payment(s) ({t['pending_amount']:,.2f} {currency}) are still pending and {t['failed_count']} failed or were cancelled.")
    if tops:
        text += f" Your top customer is {tops[0]['name']} ({tops[0]['total']:,.2f} {currency})."
    return text


def monthly_report(rows: list, month: str, currency: str) -> dict:
    in_month = [r for r in rows if month_key(effective_date(r)) == month]
    t = totals(in_month, currency)
    cats, tops = category_breakdown(in_month, currency), top_customers(in_month, currency, 5)
    lines = [f"Report for {month}",
             f"Received: {t['received']:,.2f} {currency} from {t['completed_count']} completed payment(s).",
             f"Pending: {t['pending_count']} ({t['pending_amount']:,.2f} {currency}). Failed or cancelled: {t['failed_count']}."]
    if tops:
        lines.append("Top customers: " + "; ".join(f"{c['name']} {c['total']:,.2f}" for c in tops) + ".")
    if cats:
        lines.append("Main categories: " + "; ".join(f"{c['category']} {c['total']:,.2f}" for c in cats[:3]) + ".")
    if not in_month:
        lines.append("No payments were recorded for this month.")
    return {"month": month, "totals": t, "top_customers": tops, "categories": cats, "text": "\n".join(lines)}
