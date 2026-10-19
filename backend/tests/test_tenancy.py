"""Stretch goal: a second company shares the app but never sees Siam Bean's data."""

from tests.conftest import BAKERY_ADMIN, as_role, auth, create_order, customer_by_name, product_by_sku


def bakery(client, method, path, **kwargs):
    return client.request(method, path, headers=auth(BAKERY_ADMIN), **kwargs)


def test_bakery_sees_only_its_own_master_data(client):
    skus = [row["sku"] for row in bakery(client, "GET", "/products").json()["items"]]
    assert skus == ["FLR-25KG", "BTR-1KG"]
    names = [row["name"] for row in bakery(client, "GET", "/customers").json()["items"]]
    assert "Café Lune" not in names


def test_bakery_cannot_touch_siam_bean_rows_by_id(client):
    arabica = product_by_sku(client, "ARB-1KG")
    lune = customer_by_name(client, "Café Lune")
    order = create_order(client, "Café Lune", [("ARB-1KG", 20)]).json()

    assert bakery(client, "PATCH", f"/products/{arabica['id']}", json={"price": "1"}).status_code == 404
    assert bakery(client, "PATCH", f"/customers/{lune['id']}", json={"name": "x"}).status_code == 404
    assert bakery(client, "GET", f"/orders/{order['id']}").status_code == 404
    assert bakery(client, "POST", f"/orders/{order['id']}/confirm").status_code == 404
    assert bakery(client, "POST", "/stock/movements", json={"product_id": arabica["id"], "kind": "in", "quantity": 5}).status_code == 404
    assert bakery(client, "POST", "/orders", json={"customer_id": lune["id"], "lines": [{"product_id": arabica["id"], "quantity": 1}]}).status_code == 422
    assert product_by_sku(client, "ARB-1KG")["on_hand"] == 170


def test_numbers_and_dashboard_are_per_company(client):
    order = create_order(client, "Café Lune", [("ARB-1KG", 20)]).json()
    client.post(f"/orders/{order['id']}/confirm", headers=as_role("sales"))

    customer_id = bakery(client, "GET", "/customers").json()["items"][0]["id"]
    product_id = bakery(client, "GET", "/products").json()["items"][0]["id"]
    bakery_order = bakery(client, "POST", "/orders", json={"customer_id": customer_id, "lines": [{"product_id": product_id, "quantity": 1}]}).json()
    assert bakery_order["number"] == "SO-0001"
    invoice = bakery(client, "POST", f"/orders/{bakery_order['id']}/confirm").json()["invoice"]
    assert invoice["number"] == "INV-0001"

    assert [i["number"] for i in bakery(client, "GET", "/invoices").json()] == ["INV-0001"]
    assert bakery(client, "GET", "/dashboard").json()["open_invoices_count"] == 1
    assert client.get("/dashboard", headers=as_role("admin")).json()["open_invoices_count"] == 1
    users = [u["email"] for u in bakery(client, "GET", "/users").json()]
    assert users == ["bakery@chiangmaibakery.example.com"]
