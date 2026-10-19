# 06 Confirm order → stock → invoice (US-1)

**Module:** Sales and invoices · **Owner:** _fill in_ · **Status:** done

## What
`POST /orders/{id}/confirm` in one transaction: lock products, check on hand per product, one negative movement per line (ref SO-000x), status confirmed, invoice INV-000x with subtotal, 7% VAT and total, due date from payment terms.

## Acceptance
- [x] 170 kg ARB-1KG, confirm 20 kg for Café Lune → on hand 150, INV-0001 = 9,000.00 + 630.00 = 9,630.00
- [x] Invoice has the same lines as the order
- [x] 200 kg → 409 "Not enough stock for ARB-1KG …", stock, order and invoice numbers unchanged
- [x] Two lines, only the second short → nothing changes (all or nothing)
- [x] Confirming twice → 409
- [x] Changing the product price afterwards does not change the invoice
- [x] Warehouse → 403

## Tests
`tests/test_orders.py`
