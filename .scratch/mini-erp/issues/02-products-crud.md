# 02 Products CRUD

**Module:** Master data · **Owner:** _fill in_ · **Status:** done

## What
Admin creates, lists, edits and deactivates products. Everyone can list them with on hand.

## Acceptance
- [x] Create a product, list products, edit a price, deactivate a product
- [x] Negative price → 422 "Price must be 0 or more"
- [x] Duplicate SKU → 409 "SKU ARB-1KG already exists"
- [x] Sales cannot edit a product (403)
- [x] Sample products loaded by `seed.py`

## Tests
`tests/test_products.py`
