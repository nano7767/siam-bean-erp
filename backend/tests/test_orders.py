"""US-1: create and confirm a sales order → stock goes down and an invoice is issued."""

from datetime import date, timedelta
from decimal import Decimal

from tests.conftest import as_role, create_order, customer_by_name, product_by_sku


def confirm(client, order_id, role="sales"):
    return client.post(f"/orders/{order_id}/confirm", headers=as_role(role))


def test_create_draft_order_copies_prices(client):
    response = create_order(client, "Café Lune", [("ARB-1KG", 20)])
    assert response.status_code == 201, response.text
    order = response.json()
    assert order["number"] == "SO-0001"
    assert order["status"] == "draft"
    assert order["customer"]["name"] == "Café Lune"
    [line] = order["lines"]
    assert line["sku"] == "ARB-1KG"
    assert line["quantity"] == 20
    assert Decimal(line["unit_price"]) == Decimal("450")
    assert Decimal(line["line_total"]) == Decimal("9000")
    assert Decimal(order["subtotal"]) == Decimal("9000")
    assert Decimal(order["vat"]) == Decimal("630")
    assert Decimal(order["total"]) == Decimal("9630")


def test_draft_has_no_effect_on_stock(client):
    create_order(client, "Café Lune", [("ARB-1KG", 20)])
    assert product_by_sku(client, "ARB-1KG")["on_hand"] == 170


def test_order_quantity_must_be_positive(client):
    response = create_order(client, "Café Lune", [("ARB-1KG", 0)])
    assert response.status_code == 422
    assert response.json()["detail"] == "Quantity must be greater than zero"


def test_order_needs_at_least_one_line(client):
    response = create_order(client, "Café Lune", [])
    assert response.status_code == 422
    assert response.json()["detail"] == "Add at least one product to the order"


def test_us1_confirm_reduces_stock_and_issues_invoice(client):
    order = create_order(client, "Café Lune", [("ARB-1KG", 20)]).json()

    response = confirm(client, order["id"])

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["order"]["status"] == "confirmed"
    invoice = body["invoice"]
    assert invoice["number"] == "INV-0001"
    assert Decimal(invoice["subtotal"]) == Decimal("9000.00")
    assert Decimal(invoice["vat"]) == Decimal("630.00")
    assert Decimal(invoice["total"]) == Decimal("9630.00")
    assert invoice["status"] == "open"
    assert product_by_sku(client, "ARB-1KG")["on_hand"] == 150


def test_invoice_has_the_same_lines_and_total_as_the_order(client):
    order = create_order(client, "Sukhumvit Corner Café", [("ARB-1KG", 20), ("DRP-10", 3)]).json()
    invoice_id = confirm(client, order["id"]).json()["invoice"]["id"]
    invoice = client.get(f"/invoices/{invoice_id}", headers=as_role("accountant")).json()
    assert [(l["sku"], l["quantity"], l["unit_price"]) for l in invoice["lines"]] == [
        (l["sku"], l["quantity"], l["unit_price"]) for l in order["lines"]
    ]
    assert Decimal(invoice["subtotal"]) == Decimal("9450")  # 20 × 450 + 3 × 150
    assert Decimal(invoice["vat"]) == Decimal("661.50")
    assert Decimal(invoice["total"]) == Decimal("10111.50")
    assert invoice["order"]["number"] == order["number"]
    assert invoice["customer"]["tax_id"] == "0105563000033"


def test_invoice_due_date_follows_payment_terms(client):
    order = create_order(client, "Café Lune", [("ARB-1KG", 1)]).json()
    invoice = confirm(client, order["id"]).json()["invoice"]
    issued = date.fromisoformat(invoice["issue_date"])
    assert date.fromisoformat(invoice["due_date"]) == issued + timedelta(days=30)


def test_stock_movement_references_the_order(client):
    order = create_order(client, "Café Lune", [("ARB-1KG", 20)]).json()
    confirm(client, order["id"])
    arabica = product_by_sku(client, "ARB-1KG")
    card = client.get(f"/products/{arabica['id']}/movements", headers=as_role("warehouse")).json()
    assert (card[0]["ref_doc"], card[0]["quantity"], card[0]["balance"]) == ("SO-0001", -20, 150)


def test_us1_too_little_stock_is_an_error_and_nothing_changes(client):
    order = create_order(client, "Café Lune", [("ARB-1KG", 200)]).json()

    response = confirm(client, order["id"])

    assert response.status_code == 409
    assert response.json()["detail"].startswith("Not enough stock for ARB-1KG")
    assert product_by_sku(client, "ARB-1KG")["on_hand"] == 170
    assert client.get(f"/orders/{order['id']}", headers=as_role("sales")).json()["status"] == "draft"
    assert client.get("/invoices", headers=as_role("admin")).json() == []


def test_confirm_is_all_or_nothing_across_lines(client):
    # The first line has enough stock, the second does not: neither may move.
    order = create_order(client, "Café Lune", [("ARB-1KG", 20), ("ROB-1KG", 36)]).json()
    response = confirm(client, order["id"])
    assert response.status_code == 409
    assert "ROB-1KG" in response.json()["detail"]
    assert product_by_sku(client, "ARB-1KG")["on_hand"] == 170
    assert product_by_sku(client, "ROB-1KG")["on_hand"] == 35


def test_same_product_on_two_lines_is_checked_together(client):
    order = create_order(client, "Café Lune", [("ROB-1KG", 20), ("ROB-1KG", 20)]).json()
    assert confirm(client, order["id"]).status_code == 409
    assert product_by_sku(client, "ROB-1KG")["on_hand"] == 35


def test_a_failed_confirm_does_not_burn_an_invoice_number(client):
    too_big = create_order(client, "Café Lune", [("ARB-1KG", 200)]).json()
    confirm(client, too_big["id"])
    ok = create_order(client, "Café Lune", [("ARB-1KG", 20)]).json()
    assert confirm(client, ok["id"]).json()["invoice"]["number"] == "INV-0001"


def test_numbers_are_sequential(client):
    first = create_order(client, "Café Lune", [("ARB-1KG", 1)]).json()
    second = create_order(client, "Brew Lab Ari", [("ARB-1KG", 1)]).json()
    assert (first["number"], second["number"]) == ("SO-0001", "SO-0002")
    assert confirm(client, second["id"]).json()["invoice"]["number"] == "INV-0001"
    assert confirm(client, first["id"]).json()["invoice"]["number"] == "INV-0002"


def test_cannot_confirm_twice(client):
    order = create_order(client, "Café Lune", [("ARB-1KG", 20)]).json()
    confirm(client, order["id"])
    response = confirm(client, order["id"])
    assert response.status_code == 409
    assert response.json()["detail"] == "SO-0001 is already confirmed"
    assert product_by_sku(client, "ARB-1KG")["on_hand"] == 150


def test_price_change_after_confirm_does_not_change_the_invoice(client):
    order = create_order(client, "Café Lune", [("ARB-1KG", 20)]).json()
    invoice_id = confirm(client, order["id"]).json()["invoice"]["id"]
    arabica = product_by_sku(client, "ARB-1KG")
    client.patch(f"/products/{arabica['id']}", json={"price": "999"}, headers=as_role("admin"))
    invoice = client.get(f"/invoices/{invoice_id}", headers=as_role("admin")).json()
    assert Decimal(invoice["total"]) == Decimal("9630")
    assert Decimal(invoice["lines"][0]["unit_price"]) == Decimal("450")


def test_edit_draft_replaces_lines(client):
    order = create_order(client, "Café Lune", [("ARB-1KG", 20)]).json()
    response = client.put(
        f"/orders/{order['id']}",
        json={
            "customer_id": customer_by_name(client, "Café Lune")["id"],
            "lines": [{"product_id": product_by_sku(client, "BLD-1KG")["id"], "quantity": 5}],
        },
        headers=as_role("sales"),
    )
    assert response.status_code == 200, response.text
    assert [(l["sku"], l["quantity"]) for l in response.json()["lines"]] == [("BLD-1KG", 5)]
    assert response.json()["number"] == "SO-0001"


def test_confirmed_order_cannot_be_edited_or_cancelled(client):
    order = create_order(client, "Café Lune", [("ARB-1KG", 20)]).json()
    confirm(client, order["id"])
    edit = client.put(
        f"/orders/{order['id']}",
        json={"customer_id": order["customer"]["id"], "lines": [{"product_id": order["lines"][0]["product_id"], "quantity": 1}]},
        headers=as_role("sales"),
    )
    assert edit.status_code == 409
    assert client.post(f"/orders/{order['id']}/cancel", headers=as_role("sales")).status_code == 409


def test_cancel_draft(client):
    order = create_order(client, "Café Lune", [("ARB-1KG", 20)]).json()
    response = client.post(f"/orders/{order['id']}/cancel", headers=as_role("sales"))
    assert response.json()["status"] == "cancelled"
    assert confirm(client, order["id"]).status_code == 409


def test_list_orders_filters_by_status(client):
    a = create_order(client, "Café Lune", [("ARB-1KG", 1)]).json()
    create_order(client, "Brew Lab Ari", [("ARB-1KG", 1)])
    confirm(client, a["id"])
    confirmed = client.get("/orders", params={"status": "confirmed"}, headers=as_role("accountant")).json()
    assert [o["number"] for o in confirmed] == ["SO-0001"]
    assert confirmed[0]["invoice_number"] == "INV-0001"
    assert len(client.get("/orders", headers=as_role("sales")).json()) == 2


def test_unknown_order_is_404(client):
    assert confirm(client, 9999).status_code == 404
