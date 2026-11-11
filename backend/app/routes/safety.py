from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.database.session import get_db
from app.models import AuditLog
from app.models.base import utcnow
from app.schemas.api import SafetyCheckIn
from app.services import safety
from app.services.data import get_data_mode, payment_rows
from app.services.serializers import iso

router = APIRouter(prefix="/safety", tags=["safety"])
DISCLAIMER = "These are advisory indicators based on simple patterns. They are not guaranteed fraud detection, and PayPilot never blocks a payment automatically."


@router.get("/alerts")
def alerts(source: str = Query("auto", pattern="^(auto|real|demo|all)$"), user=Depends(get_current_user), db=Depends(get_db)):
    rows = payment_rows(db, user.id, get_data_mode(db, user.id, source))
    return {"items": [{**a, "created_at": iso(a["created_at"])} for a in safety.detect_alerts(rows, utcnow())], "disclaimer": DISCLAIMER}


@router.get("/activity")
def activity(limit: int = Query(50, ge=1, le=200), user=Depends(get_current_user), db=Depends(get_db)):
    rows = db.scalars(select(AuditLog).where(AuditLog.user_id == user.id).order_by(AuditLog.id.desc()).limit(limit))
    return [{"id": r.id, "time": iso(r.created_at), "action": r.action, "details": r.details} for r in rows]


@router.post("/check-payment")
def check_payment(body: SafetyCheckIn, user=Depends(get_current_user), db=Depends(get_db), settings=Depends(get_settings)):
    cur = (body.currency or settings.paypal_default_currency).upper()
    rows = payment_rows(db, user.id, "demo" if not settings.paypal_configured else "real")
    return {"warnings": safety.check_new_payment(rows, body.customer_name, float(body.amount), cur, utcnow())}
