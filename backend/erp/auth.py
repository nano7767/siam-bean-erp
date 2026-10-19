"""Authentication with Supabase Auth, roles from our own `users` table.

Supabase owns passwords. We only ever see an access token, ask Supabase who it
belongs to, then look up that user's company and role here.
"""

import os
import time
import uuid

import httpx
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from erp.db import get_db
from erp.models import User


class SupabaseAuthError(Exception):
    pass


def _supabase_url() -> str:
    return os.environ["SUPABASE_URL"].rstrip("/")


def _public_headers() -> dict[str, str]:
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ["SUPABASE_SECRET_KEY"]
    return {"apikey": key}


def _admin_headers() -> dict[str, str]:
    key = os.environ["SUPABASE_SECRET_KEY"]
    headers = {"apikey": key}
    if key.startswith("eyJ"):  # legacy service_role JWT must also be sent as a bearer token
        headers["Authorization"] = f"Bearer {key}"
    return headers


def _error_message(response: httpx.Response) -> str:
    try:
        body = response.json()
    except ValueError:
        return response.text
    return body.get("msg") or body.get("error_description") or body.get("message") or str(body)


def _token_request(grant_type: str, body: dict) -> dict:
    response = httpx.post(
        f"{_supabase_url()}/auth/v1/token",
        params={"grant_type": grant_type},
        json=body,
        headers=_public_headers(),
        timeout=10,
    )
    if response.status_code != 200:
        raise SupabaseAuthError(_error_message(response))
    return response.json()


def supabase_password_grant(email: str, password: str) -> dict:
    return _token_request("password", {"email": email, "password": password})


def supabase_refresh_grant(refresh_token: str) -> dict:
    return _token_request("refresh_token", {"refresh_token": refresh_token})


def supabase_create_user(email: str, password: str) -> uuid.UUID:
    response = httpx.post(
        f"{_supabase_url()}/auth/v1/admin/users",
        json={"email": email, "password": password, "email_confirm": True},
        headers=_admin_headers(),
        timeout=10,
    )
    if response.status_code not in (200, 201):
        raise SupabaseAuthError(_error_message(response))
    return uuid.UUID(response.json()["id"])


_token_cache: dict[str, tuple[uuid.UUID, float]] = {}
TOKEN_CACHE_SECONDS = 60


def supabase_user_id(token: str) -> uuid.UUID:
    """Ask Supabase who owns this access token (cached briefly to keep pages fast)."""
    cached = _token_cache.get(token)
    if cached and cached[1] > time.monotonic():
        return cached[0]
    response = httpx.get(
        f"{_supabase_url()}/auth/v1/user",
        headers={**_public_headers(), "Authorization": f"Bearer {token}"},
        timeout=10,
    )
    if response.status_code != 200:
        raise SupabaseAuthError(_error_message(response))
    user_id = uuid.UUID(response.json()["id"])
    if len(_token_cache) > 1000:
        _token_cache.clear()
    _token_cache[token] = (user_id, time.monotonic() + TOKEN_CACHE_SECONDS)
    return user_id


def get_token_user_id(authorization: str | None = Header(default=None)) -> uuid.UUID:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Please log in")
    try:
        return supabase_user_id(authorization.removeprefix("Bearer "))
    except SupabaseAuthError:
        raise HTTPException(status_code=401, detail="Your session has expired, please log in again")


def get_current_user(
    user_id: uuid.UUID = Depends(get_token_user_id), db: Session = Depends(get_db)
) -> User:
    user = db.get(User, user_id)
    if user is None or not user.active:
        raise HTTPException(
            status_code=403, detail="This account has no access to the ERP. Ask the admin to add you."
        )
    return user


def require(*roles: str):
    """Dependency that lets only the given roles through, everyone else gets 403."""

    def check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Your role ({user.role}) cannot do this. Allowed: {', '.join(roles)}.",
            )
        return user

    return check


ANY_ROLE = ("admin", "sales", "warehouse", "accountant")
