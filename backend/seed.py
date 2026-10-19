"""Create the tables in Supabase and load the Siam Bean sample data.

    uv run seed.py           # create missing tables, load sample data if the database is empty
    uv run seed.py --reset   # DROP every ERP table and start again (run before the demo!)

Needs DATABASE_URL, SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env.
Demo logins get the password in DEMO_PASSWORD (default below).
"""

import os
import sys
import uuid

import httpx
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from erp import auth
from erp.db import Base, make_engine
from erp.models import Company
from erp.seed import BAKERY_ADMIN_EMAIL, SIAM_BEAN_USERS, load_sample_data, load_second_company

DEFAULT_PASSWORD = "SiamBean2026!"


def find_auth_user(email: str) -> uuid.UUID | None:
    response = httpx.get(
        f"{auth._supabase_url()}/auth/v1/admin/users",
        params={"page": 1, "per_page": 1000},
        headers=auth._admin_headers(),
        timeout=10,
    )
    response.raise_for_status()
    for user in response.json()["users"]:
        if user["email"].lower() == email.lower():
            return uuid.UUID(user["id"])
    return None


def ensure_auth_user(email: str, password: str) -> uuid.UUID:
    """Create the Supabase Auth login, or reset its password if it already exists."""
    user_id = find_auth_user(email)
    if user_id is None:
        return auth.supabase_create_user(email, password)
    response = httpx.put(
        f"{auth._supabase_url()}/auth/v1/admin/users/{user_id}",
        json={"password": password, "email_confirm": True},
        headers=auth._admin_headers(),
        timeout=10,
    )
    response.raise_for_status()
    return user_id


def main():
    reset = "--reset" in sys.argv
    password = os.environ.get("DEMO_PASSWORD", DEFAULT_PASSWORD)
    engine = make_engine()

    if reset:
        print("Dropping all ERP tables…")
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    if engine.dialect.name == "postgresql":
        # Only FastAPI talks to the database. RLS with no policy makes Supabase's public
        # REST API return nothing for these tables, even with the publishable key.
        with engine.begin() as connection:
            for table in Base.metadata.sorted_tables:
                connection.execute(text(f'alter table "{table.name}" enable row level security'))

    with Session(engine) as db:
        if db.scalar(select(Company.id).limit(1)) is not None:
            print("Data already loaded. Use --reset to start again.")
            return

        print("Creating demo logins in Supabase Auth…")
        user_ids = {key: ensure_auth_user(email, password) for key, email, _, _ in SIAM_BEAN_USERS}
        bakery_admin = ensure_auth_user(BAKERY_ADMIN_EMAIL, password)

        load_sample_data(db, user_ids)
        load_second_company(db, bakery_admin)
        db.commit()

    print("Done. Demo accounts (password: %s):" % password)
    for _, email, name, role in SIAM_BEAN_USERS:
        print(f"  {role:<11} {name:<13} {email}")
    print(f"  {'admin':<11} {'(2nd company)':<13} {BAKERY_ADMIN_EMAIL}")


if __name__ == "__main__":
    main()
