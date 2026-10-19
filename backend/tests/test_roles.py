"""US-3: each role only does what it is allowed to, enforced by the API."""

import uuid

import pytest

from erp import auth as auth_module
from tests.conftest import as_role, auth, create_order

ALL_ROLES = ["admin", "sales", "warehouse", "accountant"]

# (method, path, roles allowed) — one row per line of the permission matrix in the spec.
# Bodies are deliberately empty: an allowed role gets past the role check and fails
# validation (422) or succeeds; a forbidden role must be stopped with 403 first.
MATRIX = [
    ("GET", "/dashboard", ALL_ROLES),
    ("GET", "/products", ALL_ROLES),
    ("POST", "/products", ["admin"]),
    ("PATCH", "/products/1", ["admin"]),
    ("GET", "/products/1/movements", ["admin", "warehouse"]),
    ("GET", "/customers", ["admin", "sales", "accountant"]),
    ("POST", "/customers", ["admin", "sales"]),
    ("PATCH", "/customers/1", ["admin", "sales"]),
    ("GET", "/stock/movements", ["admin", "warehouse"]),
    ("POST", "/stock/movements", ["admin", "warehouse"]),
    ("GET", "/orders", ["admin", "sales", "accountant"]),
    ("POST", "/orders", ["admin", "sales"]),
    ("POST", "/orders/1/confirm", ["admin", "sales"]),
    ("POST", "/orders/1/cancel", ["admin", "sales"]),
    ("GET", "/invoices", ["admin", "sales", "accountant"]),
    ("POST", "/invoices/1/payments", ["admin", "accountant"]),
    ("GET", "/payments", ["admin", "accountant"]),
    ("GET", "/users", ["admin"]),
    ("POST", "/users", ["admin"]),
]


@pytest.mark.parametrize("method,path,allowed", MATRIX)
@pytest.mark.parametrize("role", ALL_ROLES)
def test_permission_matrix(client, role, method, path, allowed):
    response = client.request(method, path, json={}, headers=as_role(role))
    if role in allowed:
        assert response.status_code != 403, response.text
    else:
        assert response.status_code == 403, response.text
        assert role in response.json()["detail"].lower()


def test_no_token_is_401(client):
    assert client.get("/dashboard").status_code == 401


def test_unknown_user_is_403(client):
    response = client.get("/dashboard", headers=auth(uuid.uuid4()))
    assert response.status_code == 403


def test_deactivated_user_is_403(client):
    sales_id = client.get("/me", headers=as_role("sales")).json()["id"]
    client.patch(f"/users/{sales_id}", json={"active": False}, headers=as_role("admin"))
    assert client.get("/dashboard", headers=as_role("sales")).status_code == 403


def test_me_returns_role_and_company(client):
    me = client.get("/me", headers=as_role("warehouse")).json()
    assert me["role"] == "warehouse"
    assert me["company"]["name"] == "Siam Bean Co."


def test_warehouse_cannot_confirm_an_order_by_calling_the_api(client):
    order = create_order(client, "Café Lune", [("ARB-1KG", 20)]).json()
    response = client.post(f"/orders/{order['id']}/confirm", headers=as_role("warehouse"))
    assert response.status_code == 403
    order_after = client.get(f"/orders/{order['id']}", headers=as_role("sales")).json()
    assert order_after["status"] == "draft"


def test_sales_is_denied_accounting_and_admin_is_not(client):
    assert client.get("/payments", headers=as_role("sales")).status_code == 403
    assert client.get("/payments", headers=as_role("admin")).status_code == 200


def test_login_with_wrong_password_is_401(client, monkeypatch):
    def reject(email, password):
        raise auth_module.SupabaseAuthError("Invalid login credentials")

    monkeypatch.setattr(auth_module, "supabase_password_grant", reject)
    response = client.post("/auth/login", json={"email": "nok@x.com", "password": "nope"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Wrong email or password"


def test_login_returns_token_and_role(client, monkeypatch):
    sales_id = client.get("/me", headers=as_role("sales")).json()["id"]
    monkeypatch.setattr(
        auth_module,
        "supabase_password_grant",
        lambda email, password: {
            "access_token": "a",
            "refresh_token": "r",
            "expires_in": 3600,
            "user": {"id": sales_id},
        },
    )
    body = client.post("/auth/login", json={"email": "s@x.com", "password": "pw"}).json()
    assert body["access_token"] == "a"
    assert body["user"]["role"] == "sales"


def test_admin_creates_user_with_role(client, monkeypatch):
    new_id = uuid.uuid4()
    monkeypatch.setattr(auth_module, "supabase_create_user", lambda email, password: new_id)
    response = client.post(
        "/users",
        json={"email": "ploy@siambean.example.com", "password": "secret123", "name": "Ploy", "role": "sales"},
        headers=as_role("admin"),
    )
    assert response.status_code == 201, response.text
    assert client.get("/me", headers=auth(new_id)).json()["role"] == "sales"


def test_invalid_role_is_rejected(client, monkeypatch):
    monkeypatch.setattr(auth_module, "supabase_create_user", lambda email, password: uuid.uuid4())
    response = client.post(
        "/users",
        json={"email": "x@siambean.example.com", "password": "secret123", "name": "X", "role": "boss"},
        headers=as_role("admin"),
    )
    assert response.status_code == 422
