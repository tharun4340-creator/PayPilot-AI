import hashlib
import json
import time
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.core.config import get_settings
from app.core.deps import get_current_user, get_llm, rate_limit
from app.database.session import get_db
from app.models.base import utcnow
from app.services import analytics, safety
from app.services.command_parser import parse_command
from app.services.data import get_data_mode, payment_rows, recent_payments, transaction_events
from app.services.i18n import LANGUAGE_NAMES, t
from app.services.llm import narrative
from app.services.money import format_money
from app.services.reports import rows_to_csv
from app.schemas.api import AskIn

router = APIRouter(prefix="/analytics", tags=["analytics"])
SRC = Query("auto", pattern="^(auto|real|demo|all)$")
DISCLAIMER = "Insights describe your past payments. They are not financial advice or a guarantee of future results."
_cache: dict = {}


def _context(db, user, settings, source):
    mode = get_data_mode(db, user.id, source)
    rows = payment_rows(db, user.id, mode)
    return mode, rows, analytics.primary_currency(rows, settings.paypal_default_currency)


def _cached(key, producer, ttl=600):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    value = producer()
    _cache[key] = (time.time(), value)
    if len(_cache) > 200:
        _cache.clear()
    return value


@router.get("/dashboard")
def dashboard(source: str = SRC, user=Depends(get_current_user), db=Depends(get_db), settings=Depends(get_settings)):
    mode, rows, cur = _context(db, user, settings, source)
    now = utcnow()
    return {"data_mode": mode, "totals": analytics.totals(rows, cur), "monthly": analytics.monthly_series(rows, 6, now, cur),
            "recent": recent_payments(db, user.id, mode, 6), "timeline": transaction_events(db, user.id, mode, 12),
            "top_customers": analytics.top_customers(rows, cur, 5), "insights": analytics.build_insights(rows, now, cur),
            "alert_count": len(safety.detect_alerts(rows, now))}


@router.get("/insights")
def insights(source: str = SRC, language: str = Query("en", pattern="^(en|ta|hi)$"), user=Depends(get_current_user), db=Depends(get_db),
             settings=Depends(get_settings), llm=Depends(get_llm)):
    mode, rows, cur = _context(db, user, settings, source)
    now = utcnow()
    tot = analytics.totals(rows, cur)
    payload = {"data_mode": mode, "totals": tot, "monthly": analytics.monthly_series(rows, 6, now, cur), "top_customers": analytics.top_customers(rows, cur, 5),
               "categories": analytics.category_breakdown(rows, cur)}
    fallback = analytics.rule_based_summary(rows, now, cur)
    key = ("insights", user.id, mode, language, hashlib.sha1(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest(), llm is not None)
    text, by = _cached(key, lambda: narrative(llm, "You summarise a small business's payment data in 3 sentences. Mention that DEMO DATA is sample data when data_mode is 'demo'.",
                                              payload, fallback, LANGUAGE_NAMES[language])) if rows else (fallback, "rule-based")
    patterns = [{**p, "last_payment": p["last_payment"].isoformat() + "Z" if p["last_payment"] else None} for p in analytics.customer_patterns(rows, cur)]
    alerts = [{**a, "created_at": a["created_at"].isoformat() + "Z"} for a in safety.detect_alerts(rows, now)]
    return {"data_mode": mode, "summary": tot, "monthly": payload["monthly"], "categories": payload["categories"], "customer_patterns": patterns,
            "alerts": alerts, "ai_summary": {"text": text, "generated_by": by}, "disclaimer": DISCLAIMER}


@router.post("/ask", dependencies=[Depends(rate_limit("ask", 20))])
def ask(body: AskIn, user=Depends(get_current_user), db=Depends(get_db), settings=Depends(get_settings), llm=Depends(get_llm)):
    mode, rows, cur = _context(db, user, settings, "auto")
    now = utcnow()
    cur_month = analytics.month_key(now)
    context = {"data_mode": mode, "currency": cur, "this_month": analytics.monthly_report(rows, cur_month, cur)["totals"], "monthly": analytics.monthly_series(rows, 6, now, cur),
               "top_customers": analytics.top_customers(rows, cur, 5), "categories": analytics.category_breakdown(rows, cur),
               "customer_patterns": [{k: v for k, v in p.items() if k != "last_payment"} for p in analytics.customer_patterns(rows, cur)[:10]]}
    lang = body.language
    if llm is not None:
        text, by = narrative(llm, "Answer the user's question about their payments using only the JSON data. If the data cannot answer it, say so. Question: " + body.question,
                             context, "", LANGUAGE_NAMES[lang])
        if text:
            return {"answer": text, "generated_by": by, "data_mode": mode, "disclaimer": DISCLAIMER}
    p = parse_command(body.question)
    tt = context["this_month"]
    if p["intent"] == "month_summary":
        ans = t(lang, "summary_line", month=cur_month, received=format_money(tt["received"], cur), completed=tt["completed_count"], pending=tt["pending_count"],
                pending_amount=format_money(tt["pending_amount"], cur), failed=tt["failed_count"])
    elif p["intent"] == "top_customers":
        tops = context["top_customers"]
        ans = (t(lang, "top_header") + " " + ", ".join(f"{c['name']} ({format_money(c['total'], cur)})" for c in tops)) if tops else t(lang, "no_customers")
    elif p["intent"] == "pending_payments":
        ans = t(lang, "pending_header", n=tt["pending_count"], amount=format_money(tt["pending_amount"], cur))
    else:
        ans = analytics.rule_based_summary(rows, now, cur) + " (Basic mode: connect an AI model to answer free-form questions.)"
    return {"answer": ans, "generated_by": "rule-based", "data_mode": mode, "disclaimer": DISCLAIMER}


def _report(db, user, settings, source, month, llm):
    mode, rows, cur = _context(db, user, settings, source)
    month = month or analytics.month_key(utcnow())
    rep = analytics.monthly_report(rows, month, cur)
    text, by = narrative(llm, "Write a short, plain business report for the month from this data (4-6 sentences).", {"data_mode": mode, **rep}, rep["text"]) if rows else (rep["text"], "rule-based")
    return mode, rows, cur, month, {**rep, "data_mode": mode, "text": text, "generated_by": by}


@router.get("/report")
def report(month: Optional[str] = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"), source: str = SRC, user=Depends(get_current_user),
           db=Depends(get_db), settings=Depends(get_settings), llm=Depends(get_llm)):
    return _report(db, user, settings, source, month, llm)[4]


@router.get("/report.csv")
def report_csv(month: Optional[str] = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"), source: str = SRC, user=Depends(get_current_user),
               db=Depends(get_db), settings=Depends(get_settings)):
    mode, rows, cur = _context(db, user, settings, source)
    month = month or analytics.month_key(utcnow())
    in_month = sorted([r for r in rows if analytics.month_key(analytics.effective_date(r)) == month], key=lambda r: r["created_at"])
    return Response(rows_to_csv(in_month), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="paypilot-{month}.csv"'})
