from fastapi import APIRouter, Depends

from app.core.config import get_settings

router = APIRouter(tags=["system"])


@router.get("/system/status")
def status(settings=Depends(get_settings)):
    return {"mode": settings.mode, "paypal_configured": settings.paypal_configured, "paypal_env": settings.paypal_env,
            "llm_configured": settings.llm_configured, "llm_provider": settings.llm_provider or None,
            "default_currency": settings.paypal_default_currency, "languages": ["en", "ta", "hi"], "webhook_configured": bool(settings.paypal_webhook_id)}
