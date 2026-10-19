from decimal import Decimal

from tests.conftest import as_role, create_order, product_by_sku

NEW_PRODUCT = {
    "sku": "GES-1KG",
    "name": "Geisha, 1 kg bag",
    "unit": "kg",
    "price": "1200",
    "cost": "800",
    "reorder_level": 10,
}


def test_sample_products_are_loaded_with_opening_stock(client):
    body = client.get("/products", headers=as_role("warehouse")).json()
    on_hand = {row["sku"]: row["on_hand"] for row in body["items"]}
    assert on_hand == {"ARB-1KG": 170, "ROB-1KG": 35, "BLD-1KG": 90, "DRP-10": 240}
    assert body["total"] == 4


def test_create_product(client):
    response = client.post("/products", json=NEW_PRODUCT, headers=as_role("admin"))
    assert response.status_code == 201, response.text
    product = response.json()
    assert product["sku"] == "GES-1KG"
    assert Decimal(product["price"]) == Decimal("1200")
    assert product["on_hand"] == 0
    assert product["active"] is True


def test_list_products_search(client):
    items = client.get("/products", params={"q": "robusta"}, headers=as_role("sales")).json()["items"]
    assert [row["sku"] for row in items] == ["ROB-1KG"]


def test_edit_a_price(client):
    arabica = product_by_sku(client, "ARB-1KG")
    response = client.patch(f"/products/{arabica['id']}", json={"price": "480"}, headers=as_role("admin"))
    assert response.status_code == 200, response.text
    assert Decimal(product_by_sku(client, "ARB-1KG")["price"]) == Decimal("480")


def test_deactivate_a_product(client):
    drip = product_by_sku(client, "DRP-10")
    response = client.patch(f"/products/{drip['id']}", json={"active": False}, headers=as_role("admin"))
    assert response.status_code == 200
    skus = [row["sku"] for row in client.get("/products", headers=as_role("admin")).json()["items"]]
    assert "DRP-10" not in skus
    all_rows = client.get("/products", params={"include_inactive": True}, headers=as_role("admin"))
    assert "DRP-10" in [row["sku"] for row in all_rows.json()["items"]]


def test_inactive_product_cannot_be_ordered(client):
    drip = product_by_sku(client, "DRP-10")
    client.patch(f"/products/{drip['id']}", json={"active": False}, headers=as_role("admin"))
    response = create_order(client, "Café Lune", [("DRP-10", 1)])
    assert response.status_code == 422
    assert "DRP-10" in response.json()["detail"]


def test_reject_a_negative_price(client):
    response = client.post("/products", json={**NEW_PRODUCT, "price": "-1"}, headers=as_role("admin"))
    assert response.status_code == 422
    assert response.json()["detail"] == "Price must be 0 or more"


def test_reject_a_duplicate_sku(client):
    response = client.post("/products", json={**NEW_PRODUCT, "sku": "ARB-1KG"}, headers=as_role("admin"))
    assert response.status_code == 409
    assert response.json()["detail"] == "SKU ARB-1KG already exists"


def test_reject_missing_name(client):
    response = client.post("/products", json={**NEW_PRODUCT, "name": "  "}, headers=as_role("admin"))
    assert response.status_code == 422
    assert response.json()["detail"] == "Name is required"


def test_sales_cannot_change_a_price(client):
    arabica = product_by_sku(client, "ARB-1KG")
    response = client.patch(f"/products/{arabica['id']}", json={"price": "1"}, headers=as_role("sales"))
    assert response.status_code == 403
    assert Decimal(product_by_sku(client, "ARB-1KG")["price"]) == Decimal("450")


def test_unknown_product_is_404(client):
    assert client.patch("/products/9999", json={"price": "1"}, headers=as_role("admin")).status_code == 404
