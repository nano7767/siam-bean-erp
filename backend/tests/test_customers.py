import time

from tests.conftest import as_role, create_order, customer_by_name

NEW_CUSTOMER = {
    "name": "Roast & Toast Silom",
    "tax_id": "0105564000044",
    "address": "12 Silom Rd, Bangkok",
    "contact": "Khun May 081-234-5678",
    "payment_terms_days": 30,
}


def test_sample_customers_are_loaded(client):
    items = client.get("/customers", headers=as_role("sales")).json()["items"]
    terms = {row["name"]: row["payment_terms_days"] for row in items}
    assert terms == {"Café Lune": 30, "Brew Lab Ari": 0, "Sukhumvit Corner Café": 15}


def test_create_customer(client):
    response = client.post("/customers", json=NEW_CUSTOMER, headers=as_role("sales"))
    assert response.status_code == 201, response.text
    assert response.json()["tax_id"] == "0105564000044"


def test_tax_id_is_required(client):
    response = client.post("/customers", json={**NEW_CUSTOMER, "tax_id": ""}, headers=as_role("sales"))
    assert response.status_code == 422
    assert response.json()["detail"] == "Tax ID must be 13 digits"


def test_tax_id_must_be_13_digits(client):
    response = client.post("/customers", json={**NEW_CUSTOMER, "tax_id": "12345"}, headers=as_role("sales"))
    assert response.status_code == 422
    assert response.json()["detail"] == "Tax ID must be 13 digits"


def test_edit_customer(client):
    lune = customer_by_name(client, "Café Lune")
    response = client.patch(
        f"/customers/{lune['id']}", json={"payment_terms_days": 45}, headers=as_role("sales")
    )
    assert response.status_code == 200
    assert customer_by_name(client, "Café Lune")["payment_terms_days"] == 45


def test_deactivated_customer_is_hidden_and_cannot_order(client):
    brew = customer_by_name(client, "Brew Lab Ari")
    client.patch(f"/customers/{brew['id']}", json={"active": False}, headers=as_role("admin"))
    names = [row["name"] for row in client.get("/customers", headers=as_role("sales")).json()["items"]]
    assert "Brew Lab Ari" not in names
    response = client.post(
        "/orders",
        json={"customer_id": brew["id"], "lines": [{"product_id": 1, "quantity": 1}]},
        headers=as_role("sales"),
    )
    assert response.status_code == 422
    assert "Brew Lab Ari" in response.json()["detail"]


def test_accountant_can_view_but_not_edit_customers(client):
    assert client.get("/customers", headers=as_role("accountant")).status_code == 200
    assert client.post("/customers", json=NEW_CUSTOMER, headers=as_role("accountant")).status_code == 403


def test_us5_search_200_customers_filters_fast_and_pages_by_20(client):
    for i in range(197):
        client.post(
            "/customers",
            json={**NEW_CUSTOMER, "name": f"Test Café {i:03d}", "tax_id": f"{i:013d}"},
            headers=as_role("admin"),
        )
    start = time.perf_counter()
    response = client.get("/customers", params={"q": "café 1"}, headers=as_role("sales"))
    elapsed = time.perf_counter() - start
    body = response.json()
    assert elapsed < 1
    assert body["total"] == 97  # Test Café 100 … Test Café 196
    assert len(body["items"]) == 20
    assert all("café 1" in row["name"].lower() for row in body["items"])
    page_5 = client.get("/customers", params={"q": "café 1", "page": 5}, headers=as_role("sales")).json()
    assert len(page_5["items"]) == 17


def test_search_by_tax_id(client):
    items = client.get("/customers", params={"q": "0105562"}, headers=as_role("sales")).json()["items"]
    assert [row["name"] for row in items] == ["Brew Lab Ari"]


def test_order_uses_customer_lookup(client):
    assert create_order(client, "Café Lune", [("ARB-1KG", 1)]).status_code == 201
