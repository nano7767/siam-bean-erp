# 08 Dashboard

**Module:** Sales and invoices · **Owner:** _fill in_ · **Status:** done

## What
`GET /dashboard`, computed live: sales today, low-stock count (with the products), open invoices count and amount, stock value (on hand × cost).

## Acceptance
- [x] Fresh sample data: sales today 0, low stock 1 (ROB-1KG), open invoices 0, stock value 107,100.00
- [x] After the US-1 confirm: sales today 9,630.00, open invoices 1 · 9,630.00
- [x] After the payment: open invoices 0 · 0.00
- [x] Every role can open it

## Tests
`tests/test_dashboard.py`
