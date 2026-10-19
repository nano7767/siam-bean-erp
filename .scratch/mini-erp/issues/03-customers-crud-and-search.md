# 03 Customers CRUD and search (US-5)

**Module:** Master data · **Owner:** _fill in_ · **Status:** done

## What
Admin and Sales create, edit and deactivate customers. Search by part of the name or tax ID, 20 rows per page.

## Acceptance
- [x] Tax ID required, exactly 13 digits → otherwise 422 "Tax ID must be 13 digits"
- [x] Deactivated customers are hidden from the default list and cannot get new orders
- [x] With 200 customers, `?q=lune` returns matches only, at most 20 per page, in under 1 second
- [x] Warehouse cannot list customers (403)

## Tests
`tests/test_customers.py`
