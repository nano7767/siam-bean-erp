import uuid

import pytest
from fastapi import Header, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from erp.auth import get_token_user_id
from erp.db import Base, get_db
from erp.main import app
from erp.seed import load_sample_data, load_second_company

ADMIN = uuid.UUID("00000000-0000-0000-0000-000000000001")
SALES = uuid.UUID("00000000-0000-0000-0000-000000000002")
WAREHOUSE = uuid.UUID("00000000-0000-0000-0000-000000000003")
ACCOUNTANT = uuid.UUID("00000000-0000-0000-0000-000000000004")
BAKERY_ADMIN = uuid.UUID("00000000-0000-0000-0000-000000000099")

USER_IDS = {"admin": ADMIN, "sales": SALES, "warehouse": WAREHOUSE, "accountant": ACCOUNTANT}


def fake_token_user_id(authorization: str | None = Header(default=None)) -> uuid.UUID:
    """In tests the bearer token *is* the user id, so no Supabase call is made."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Please log in")
    return uuid.UUID(authorization.removeprefix("Bearer "))


@pytest.fixture
def session_factory():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        load_sample_data(db, USER_IDS)
        load_second_company(db, BAKERY_ADMIN)
        db.commit()
    yield factory
    engine.dispose()


@pytest.fixture
def client(session_factory):
    def override_get_db():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_token_user_id] = fake_token_user_id
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def auth(user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {user_id}"}


def as_role(role: str) -> dict[str, str]:
    return auth(USER_IDS[role])


def product_by_sku(client: TestClient, sku: str) -> dict:
    rows = client.get("/products", params={"q": sku}, headers=as_role("admin")).json()["items"]
    return next(row for row in rows if row["sku"] == sku)


def customer_by_name(client: TestClient, name: str) -> dict:
    rows = client.get("/customers", params={"q": name}, headers=as_role("admin")).json()["items"]
    return next(row for row in rows if row["name"] == name)


def create_order(client: TestClient, customer: str, lines: list[tuple[str, int]], role="sales"):
    body = {
        "customer_id": customer_by_name(client, customer)["id"],
        "lines": [
            {"product_id": product_by_sku(client, sku)["id"], "quantity": qty} for sku, qty in lines
        ],
    }
    return client.post("/orders", json=body, headers=as_role(role))
