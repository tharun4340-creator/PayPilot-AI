from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.deps import get_current_user, get_paypal, rate_limit
from app.core.errors import AppError
from app.database.session import get_db
from app.models import Notification
from app.services import demo_data, invoices_service, webhook_service
from app.services.serializers import iso

notifications = APIRouter(prefix="/notifications", tags=["notifications"])
demo = APIRouter(prefix="/demo", tags=["demo"])
webhooks = APIRouter(tags=["webhooks"])


@notifications.get("")
def list_notifications(user=Depends(get_current_user), db=Depends(get_db)):
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc()).limit(50))
    return [{"id": n.id, "title": n.title, "body": n.body, "level": n.level, "read": n.read, "created_at": iso(n.created_at)} for n in rows]


@notifications.post("/read-all")
def read_all(user=Depends(get_current_user), db=Depends(get_db)):
    db.execute(update(Notification).where(Notification.user_id == user.id).values(read=True))
    db.commit()
    return {"ok": True}


@notifications.post("/generate-reminders")
def reminders(user=Depends(get_current_user), db=Depends(get_db)):
    lang = user.profile.language if user.profile else "en"
    return invoices_service.generate_reminder_notifications(db, user, lang)


@notifications.post("/{notification_id}/read")
def read_one(notification_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        raise AppError(404, "Notification not found.")
    n.read = True
    db.commit()
    return {"ok": True}


@demo.post("/seed")
def seed(user=Depends(get_current_user), db=Depends(get_db), settings=Depends(get_settings)):
    return {"created": demo_data.seed(db, user, settings.paypal_default_currency)}


@demo.delete("")
def remove(user=Depends(get_current_user), db=Depends(get_db)):
    return {"removed": demo_data.remove(db, user)}


@webhooks.post("/webhooks/paypal", dependencies=[Depends(rate_limit("webhook", 120))])
async def paypal_webhook(request: Request, db=Depends(get_db), settings=Depends(get_settings), paypal=Depends(get_paypal)):
    body = await request.body()
    return webhook_service.process(db, settings, paypal, dict(request.headers), body)
