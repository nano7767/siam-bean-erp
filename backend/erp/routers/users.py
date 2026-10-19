import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import AfterValidator, BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from erp import auth
from erp.auth import ANY_ROLE, get_current_user, require
from erp.db import get_db
from erp.models import User
from erp.rules import conflict, invalid, not_found, required_text

router = APIRouter()

Role = Literal["admin", "sales", "warehouse", "accountant"]


def user_out(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "active": user.active,
        "company": {"id": user.company.id, "name": user.company.name},
    }


class LoginIn(BaseModel):
    email: str
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


def session_out(tokens: dict, db: Session) -> dict:
    user = db.get(User, uuid.UUID(tokens["user"]["id"]))
    if user is None or not user.active:
        raise HTTPException(
            status_code=403, detail="This account has no access to the ERP. Ask the admin to add you."
        )
    return {
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "expires_in": tokens.get("expires_in", 3600),
        "user": user_out(user),
    }


@router.post("/auth/login", tags=["auth"])
def login(body: LoginIn, db: Session = Depends(get_db)):
    try:
        tokens = auth.supabase_password_grant(body.email.strip(), body.password)
    except auth.SupabaseAuthError:
        raise HTTPException(status_code=401, detail="Wrong email or password")
    return session_out(tokens, db)


@router.post("/auth/refresh", tags=["auth"])
def refresh(body: RefreshIn, db: Session = Depends(get_db)):
    try:
        tokens = auth.supabase_refresh_grant(body.refresh_token)
    except auth.SupabaseAuthError:
        raise HTTPException(status_code=401, detail="Your session has expired, please log in again")
    return session_out(tokens, db)


@router.get("/me", tags=["auth"])
def me(user: User = Depends(require(*ANY_ROLE))):
    return user_out(user)


class UserIn(BaseModel):
    email: EmailStr
    password: str
    name: Annotated[str, AfterValidator(required_text("Name"))]
    role: Role


class UserPatch(BaseModel):
    name: Annotated[str, AfterValidator(required_text("Name"))] | None = None
    role: Role | None = None
    active: bool | None = None


@router.get("/users", tags=["users"])
def list_users(user: User = Depends(require("admin")), db: Session = Depends(get_db)):
    users = db.scalars(select(User).where(User.company_id == user.company_id).order_by(User.created_at, User.email))
    return [user_out(u) for u in users]


@router.post("/users", status_code=201, tags=["users"])
def create_user(body: UserIn, admin: User = Depends(require("admin")), db: Session = Depends(get_db)):
    if len(body.password) < 8:
        raise invalid("Password must be at least 8 characters")
    if db.scalar(select(User).where(User.email == body.email.lower())):
        raise conflict(f"{body.email} already has an account")
    try:
        user_id = auth.supabase_create_user(body.email.lower(), body.password)
    except auth.SupabaseAuthError as error:
        raise conflict(f"Could not create the login: {error}")
    user = User(
        id=user_id,
        company_id=admin.company_id,
        email=body.email.lower(),
        name=body.name,
        role=body.role,
    )
    db.add(user)
    db.commit()
    return user_out(user)


@router.patch("/users/{user_id}", tags=["users"])
def update_user(
    user_id: uuid.UUID, body: UserPatch, admin: User = Depends(require("admin")), db: Session = Depends(get_db)
):
    user = db.get(User, user_id)
    if user is None or user.company_id != admin.company_id:
        raise not_found("User")
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if user.id == admin.id and (changes.get("active") is False or changes.get("role", "admin") != "admin"):
        raise conflict("You cannot remove your own admin access")
    for field, value in changes.items():
        setattr(user, field, value)
    db.commit()
    return user_out(user)
