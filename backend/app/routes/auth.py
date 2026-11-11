from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.deps import client_ip, get_current_user, rate_limit
from app.core.errors import AppError
from app.core.security import create_access_token, hash_password, verify_password
from app.database.session import get_db
from app.models import User, UserProfile
from app.schemas.api import LoginIn, ProfileUpdate, RegisterIn
from app.services.audit import log_action
from app.services.serializers import serialize_user

router = APIRouter(tags=["auth"])
_DUMMY = None


def _token(user, settings):
    return {"access_token": create_access_token(user.id, settings.secret_key, settings.access_token_minutes), "token_type": "bearer", "user": serialize_user(user)}


@router.post("/auth/register", status_code=201, dependencies=[Depends(rate_limit("register", 10))])
def register(body: RegisterIn, request: Request, db=Depends(get_db), settings=Depends(get_settings)):
    email = body.email.strip().lower()
    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise AppError(409, "An account with this email already exists. Try signing in instead.")
    user = User(email=email, password_hash=hash_password(body.password), full_name=body.full_name.strip())
    user.profile = UserProfile()
    db.add(user)
    db.flush()
    log_action(db, user.id, "auth.register", email, client_ip(request))
    db.commit()
    return _token(user, settings)


@router.post("/auth/login", dependencies=[Depends(rate_limit("login", 10))])
def login(body: LoginIn, request: Request, db=Depends(get_db), settings=Depends(get_settings)):
    global _DUMMY
    user = db.scalar(select(User).where(func.lower(User.email) == body.email.strip().lower()))
    if user is None:  # spend the same time hashing so response timing doesn't reveal which emails exist
        _DUMMY = _DUMMY or hash_password("dummy-password")
        verify_password(body.password, _DUMMY)
    if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
        log_action(db, user.id if user else None, "auth.login_failed", body.email[:120], client_ip(request))
        db.commit()
        raise AppError(401, "That email or password is not correct.")
    log_action(db, user.id, "auth.login", "", client_ip(request))
    db.commit()
    return _token(user, settings)


@router.get("/auth/me")
def me(user=Depends(get_current_user)):
    return serialize_user(user)


@router.post("/auth/logout", dependencies=[Depends(rate_limit("logout", 10))])
def logout(request: Request, user=Depends(get_current_user), db=Depends(get_db)):
    log_action(db, user.id, "auth.token_revoked", request.state.token_fingerprint, client_ip(request))
    log_action(db, user.id, "auth.logout", "", client_ip(request))
    db.commit()
    return {"ok": True}


@router.patch("/users/me")
def update_me(body: ProfileUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    if body.full_name is not None:
        user.full_name = body.full_name.strip()
    if user.profile is None:
        user.profile = UserProfile()
    if body.business_name is not None:
        user.profile.business_name = body.business_name.strip() or None
    if body.language is not None:
        user.profile.language = body.language
    if body.onboarding_completed is not None:
        user.profile.onboarding_completed = body.onboarding_completed
    db.commit()
    return serialize_user(user)
