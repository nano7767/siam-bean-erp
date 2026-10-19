"""Dashboard numbers are computed live from the same tables, never hard-coded."""

from decimal import Decimal

from tests.conftest import as_role, create_order


def dashboard(client, role="admin"):
    return client.get("/dashboard", headers=as_role(role)).json()


def test_fresh_sample_data(client):
    body = dashboard(client)
    assert Decimal(body["sales_today"]) == 0
    assert body["low_stock_count"] == 1
    assert body["open_invoices_count"] == 0
    assert Decimal(body["open_invoices_amount"]) == 0
    # 170 × 320 + 35 × 220 + 90 × 260 + 240 × 90
    assert Decimal(body["stock_value"]) == Decimal("107100")


def test_demo_flow_moves_every_number(client):
    order = create_order(client, "Café Lune", [("ARB-1KG", 20)]).json()
    assert Decimal(dashboard(client)["sales_today"]) == 0  # a draft is not a sale

    invoice = client.post(f"/orders/{order['id']}/confirm", headers=as_role("sales")).json()["invoice"]

    after_confirm = dashboard(client, role="sales")
    assert Decimal(after_confirm["sales_today"]) == Decimal("9630")
    assert after_confirm["open_invoices_count"] == 1
    assert Decimal(after_confirm["open_invoices_amount"]) == Decimal("9630")
    assert Decimal(after_confirm["stock_value"]) == Decimal("107100") - 20 * 320

    client.post(f"/invoices/{invoice['id']}/payments", json={"amount": "9630"}, headers=as_role("accountant"))

    after_payment = dashboard(client, role="accountant")
    assert Decimal(after_payment["sales_today"]) == Decimal("9630")  # still sold today
    assert after_payment["open_invoices_count"] == 0
    assert Decimal(after_payment["open_invoices_amount"]) == 0


def test_selling_below_reorder_level_raises_low_stock_count(client):
    order = create_order(client, "Café Lune", [("BLD-1KG", 61)]).json()  # 90 → 29, reorder at 30
    client.post(f"/orders/{order['id']}/confirm", headers=as_role("sales"))
    body = dashboard(client)
    assert body["low_stock_count"] == 2
    assert {row["sku"] for row in body["low_stock_products"]} == {"ROB-1KG", "BLD-1KG"}


def test_inactive_products_are_not_counted_as_low_stock(client):
    rob = client.get("/products", params={"q": "ROB"}, headers=as_role("admin")).json()["items"][0]
    client.patch(f"/products/{rob['id']}", json={"active": False}, headers=as_role("admin"))
    assert dashboard(client)["low_stock_count"] == 0
