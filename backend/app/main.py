"""PayPilot AI API entry point. Run: uvicorn app.main:app --reload"""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi import HTTPException

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import setup_logging
from app.database.session import init_db
from app.routes import analytics, assistant, auth, customers, invoices, misc, payments, safety, system

log = logging.getLogger("paypilot")


def create_app() -> FastAPI:
    setup_logging()
    settings = get_settings()
    app = FastAPI(title="PayPilot AI API", version="1.0.0",
                  description="AI-assisted payments on top of PayPal. Demo mode runs without credentials; PayPal Sandbox is used when configured.")
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_credentials=False,
                       allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response

    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError):
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def unexpected(_: Request, exc: Exception):
        log.exception("Unhandled error")
        return JSONResponse({"detail": "Something went wrong on our side. Please try again."}, status_code=500)

    prefix = "/api/v1"
    for r in (system.router, auth.router, customers.router, payments.router, invoices.router, analytics.router, safety.router, assistant.router,
              misc.notifications, misc.demo, misc.webhooks):
        app.include_router(r, prefix=prefix)

    @app.get("/health", tags=["system"])
    def health():
        return {"status": "ok"}

    # In the single-service deployment, serve the React build and let the
    # client-side router resolve application paths. Local API-only installs
    # keep working when frontend/dist does not exist.
    frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    if frontend_dist.is_dir():
        @app.get("/{asset_path:path}", include_in_schema=False)
        def frontend(asset_path: str):
            if asset_path == "api" or asset_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="Not found.")
            target = (frontend_dist / asset_path).resolve()
            if target.is_file() and frontend_dist.resolve() in target.parents:
                return FileResponse(target)
            if asset_path and "." in Path(asset_path).name:
                raise HTTPException(status_code=404, detail="Not found.")
            return FileResponse(frontend_dist / "index.html")

    @app.on_event("startup")
    def startup():
        if settings.auto_create_tables:
            init_db()
        log.info("PayPilot AI started in %s mode (AI model: %s)", settings.mode, "connected" if settings.llm_configured else "not configured")

    return app


app = create_app()
