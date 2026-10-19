# 05 Sales orders (draft)

**Module:** Sales and invoices · **Owner:** _fill in_ · **Status:** done

## What
Sales creates a draft order SO-000x for a customer with lines. Unit price and cost are copied from the product.

## Acceptance
- [x] Draft has number SO-0001, lines with unit price 450.00, subtotal 9,000.00
- [x] Quantity 0 → 422 "Quantity must be greater than zero"
- [x] Inactive customer or product → 422
- [x] Draft can be edited and cancelled; a confirmed order cannot
- [x] Draft has no effect on stock

## Tests
`tests/test_orders.py`
