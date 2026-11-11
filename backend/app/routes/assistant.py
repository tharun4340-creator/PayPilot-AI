from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.core.config import get_settings
from app.core.deps import get_current_user, get_llm, get_paypal, rate_limit
from app.core.errors import AppError
from app.database.session import get_db
from app.models import AIConversation, AIMessage, PendingAction
from app.schemas.api import ActionConfirmIn, ChatIn
from app.services import assistant_service
from app.services.serializers import iso, serialize_message

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/chat", dependencies=[Depends(rate_limit("chat", 30))])
def chat(body: ChatIn, user=Depends(get_current_user), db=Depends(get_db), settings=Depends(get_settings), llm=Depends(get_llm)):
    return assistant_service.handle_chat(db, user, settings, llm, body.message, body.conversation_id, body.language)


@router.post("/actions/{action_id}/confirm", dependencies=[Depends(rate_limit("action-confirm", 20))])
def confirm(action_id: int, body: ActionConfirmIn = ActionConfirmIn(), user=Depends(get_current_user), db=Depends(get_db),
            settings=Depends(get_settings), paypal=Depends(get_paypal)):
    return assistant_service.confirm_action(db, user, settings, paypal, action_id)


@router.post("/actions/{action_id}/cancel")
def cancel(action_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    return assistant_service.cancel_action(db, user, action_id)


@router.get("/conversations")
def conversations(user=Depends(get_current_user), db=Depends(get_db)):
    rows = db.scalars(select(AIConversation).where(AIConversation.user_id == user.id).order_by(AIConversation.updated_at.desc()).limit(50))
    return [{"id": c.id, "title": c.title, "updated_at": iso(c.updated_at)} for c in rows]


@router.get("/conversations/{conversation_id}")
def conversation(conversation_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    c = db.get(AIConversation, conversation_id)
    if not c or c.user_id != user.id:
        raise AppError(404, "Conversation not found.")
    msgs = db.scalars(select(AIMessage).where(AIMessage.conversation_id == c.id).order_by(AIMessage.id))
    out = []
    for m in msgs:
        pending = db.get(PendingAction, m.pending_action_id) if m.pending_action_id else None
        out.append(serialize_message(m, pending))
    return {"id": c.id, "messages": out}
