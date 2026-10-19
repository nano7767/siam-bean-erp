"""US-2: stock is the sum of movements, a stock-in form exists, low stock is flagged."""

from tests.conftest import as_role, product_by_sku


def stock_in(client, sku, quantity, role="warehouse", kind="in", note="Delivery from Doi Chang Farm"):
    return client.post(
        "/stock/movements",
        json={"product_id": product_by_sku(client, sku)["id"], "kind": kind, "quantity": quantity, "note": note},
        headers=as_role(role),
    )


def test_stock_in_adds_to_on_hand(client):
    response = stock_in(client, "ROB-1KG", 30)
    assert response.status_code == 201, response.text
    assert response.json()["ref_doc"] == "IN-0001"
    assert product_by_sku(client, "ROB-1KG")["on_hand"] == 65


def test_stock_in_numbers_are_sequential(client):
    stock_in(client, "ROB-1KG", 1)
    assert stock_in(client, "BLD-1KG", 1).json()["ref_doc"] == "IN-0002"


def test_stock_in_quantity_must_be_positive(client):
    for quantity in (0, -5):
        response = stock_in(client, "ROB-1KG", quantity)
        assert response.status_code == 422
        assert response.json()["detail"] == "Quantity must be greater than zero"
    assert product_by_sku(client, "ROB-1KG")["on_hand"] == 35


def test_negative_adjustment_reduces_stock(client):
    response = stock_in(client, "ARB-1KG", -3, kind="adjust", note="Damaged bags")
    assert response.status_code == 201, response.text
    assert response.json()["ref_doc"] == "ADJ-0001"
    assert product_by_sku(client, "ARB-1KG")["on_hand"] == 167


def test_adjustment_cannot_make_stock_negative(client):
    response = stock_in(client, "ROB-1KG", -36, kind="adjust")
    assert response.status_code == 409
    assert response.json()["detail"] == "Not enough stock for ROB-1KG: 35 on hand, cannot remove 36"
    assert product_by_sku(client, "ROB-1KG")["on_hand"] == 35


def test_adjustment_of_zero_is_rejected(client):
    response = stock_in(client, "ROB-1KG", 0, kind="adjust")
    assert response.status_code == 422
    assert response.json()["detail"] == "Adjustment cannot be zero"


def test_note_is_required_for_adjustments(client):
    response = stock_in(client, "ROB-1KG", -1, kind="adjust", note="")
    assert response.status_code == 422
    assert response.json()["detail"] == "Say why you adjust the stock (e.g. damaged bags)"


def test_sales_cannot_move_stock(client):
    assert stock_in(client, "ROB-1KG", 30, role="sales").status_code == 403
    assert product_by_sku(client, "ROB-1KG")["on_hand"] == 35


def test_robusta_starts_low_and_others_do_not(client):
    low = {row["sku"]: row["low_stock"] for row in client.get("/products", headers=as_role("warehouse")).json()["items"]}
    assert low == {"ARB-1KG": False, "ROB-1KG": True, "BLD-1KG": False, "DRP-10": False}


def test_low_stock_clears_after_stock_in(client):
    stock_in(client, "ROB-1KG", 10)
    assert product_by_sku(client, "ROB-1KG")["low_stock"] is False


def test_dashboard_low_stock_count_includes_it(client):
    dashboard = client.get("/dashboard", headers=as_role("warehouse")).json()
    assert dashboard["low_stock_count"] == 1
    assert [row["sku"] for row in dashboard["low_stock_products"]] == ["ROB-1KG"]


def test_stock_card_shows_movements_with_running_balance(client):
    stock_in(client, "ARB-1KG", 200)
    stock_in(client, "ARB-1KG", -3, kind="adjust", note="Damaged bags")
    arabica = product_by_sku(client, "ARB-1KG")
    card = client.get(f"/products/{arabica['id']}/movements", headers=as_role("warehouse")).json()
    assert [(row["ref_doc"], row["quantity"], row["balance"]) for row in card] == [
        ("ADJ-0001", -3, 367),
        ("IN-0001", 200, 370),
        ("OPENING", 170, 170),
    ]
    assert card[0]["created_by_name"] == "Lek"


def test_unknown_product_is_404(client):
    response = client.post(
        "/stock/movements", json={"product_id": 9999, "kind": "in", "quantity": 1}, headers=as_role("warehouse")
    )
    assert response.status_code == 404
