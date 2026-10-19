"""US-4: record a payment against an invoice so we know what is still owed."""

from decimal import Decimal

from tests.conftest import as_role, create_order


def issue_invoice(client, customer="Café Lune", lines=(("ARB-1KG", 20),)):
    order = create_order(client, customer, list(lines)).json()
    return client.post(f"/orders/{order['id']}/confirm", headers=as_role("sales")).json()["invoice"]


def pay(client, invoice_id, amount, role="accountant"):
    return client.post(
        f"/invoices/{invoice_id}/payments",
        json={"amount": amount, "method": "bank_transfer", "reference": "KBank 1234"},
        headers=as_role(role),
    )


def test_us4_full_payment_marks_invoice_paid_and_receivables_drop(client):
    invoice = issue_invoice(client)
    before = client.get("/dashboard", headers=as_role("admin")).json()
    assert Decimal(before["open_invoices_amount"]) == Decimal("9630")

    response = pay(client, invoice["id"], "9630.00")

    assert response.status_code == 201, response.text
    paid = client.get(f"/invoices/{invoice['id']}", headers=as_role("accountant")).json()
    assert paid["status"] == "paid"
    assert Decimal(paid["amount_due"]) == 0
    assert paid["order"]["status"] == "paid"
    after = client.get("/dashboard", headers=as_role("admin")).json()
    assert Decimal(before["open_invoices_amount"]) - Decimal(after["open_invoices_amount"]) == Decimal("9630")
    assert after["open_invoices_count"] == before["open_invoices_count"] - 1


def test_partial_payment_keeps_invoice_open(client):
    invoice = issue_invoice(client)
    pay(client, invoice["id"], "5000")
    body = client.get(f"/invoices/{invoice['id']}", headers=as_role("accountant")).json()
    assert body["status"] == "open"
    assert Decimal(body["amount_paid"]) == Decimal("5000")
    assert Decimal(body["amount_due"]) == Decimal("4630")
    assert pay(client, invoice["id"], "4630").status_code == 201
    assert client.get(f"/invoices/{invoice['id']}", headers=as_role("accountant")).json()["status"] == "paid"


def test_cannot_pay_more_than_is_due(client):
    invoice = issue_invoice(client)
    response = pay(client, invoice["id"], "10000")
    assert response.status_code == 422
    assert response.json()["detail"] == "Amount is more than the 9,630.00 THB still due on INV-0001"


def test_amount_must_be_positive(client):
    invoice = issue_invoice(client)
    response = pay(client, invoice["id"], "0")
    assert response.status_code == 422
    assert response.json()["detail"] == "Amount must be greater than zero"


def test_cannot_pay_a_paid_invoice(client):
    invoice = issue_invoice(client)
    pay(client, invoice["id"], "9630")
    response = pay(client, invoice["id"], "1")
    assert response.status_code == 409
    assert response.json()["detail"] == "INV-0001 is already paid"


def test_sales_cannot_record_payments(client):
    invoice = issue_invoice(client)
    assert pay(client, invoice["id"], "9630", role="sales").status_code == 403
    assert client.get(f"/invoices/{invoice['id']}", headers=as_role("sales")).json()["status"] == "open"


def test_payments_list_for_accounting(client):
    invoice = issue_invoice(client)
    pay(client, invoice["id"], "9630")
    [payment] = client.get("/payments", headers=as_role("accountant")).json()
    assert payment["invoice_number"] == "INV-0001"
    assert payment["customer_name"] == "Café Lune"
    assert Decimal(payment["amount"]) == Decimal("9630")
    assert payment["created_by_name"] == "Fon"


def test_invoice_list_filters_open(client):
    first = issue_invoice(client)
    issue_invoice(client, customer="Brew Lab Ari", lines=(("BLD-1KG", 2),))
    pay(client, first["id"], "9630")
    open_invoices = client.get("/invoices", params={"status": "open"}, headers=as_role("accountant")).json()
    assert [row["number"] for row in open_invoices] == ["INV-0002"]
    assert open_invoices[0]["customer_name"] == "Brew Lab Ari"
