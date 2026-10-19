# 04 Stock movements, stock-in form, low-stock badge (US-2)

**Module:** Stock · **Owner:** _fill in_ · **Status:** done

## What
On hand is the sum of movements. Warehouse records stock-in (IN-000x) and adjustments (ADJ-000x). Products below reorder level are low stock.

## Acceptance
- [x] Stock-in of 30 on ROB-1KG (35) → on hand 65, movement IN-0001
- [x] Stock-in quantity 0 or negative → 422 "Quantity must be greater than zero"
- [x] Adjustment that would go below zero → 409 and nothing changes
- [x] ROB-1KG (35 < 40) has `low_stock: true`; dashboard low-stock count includes it
- [x] Sales cannot post movements (403)

## Tests
`tests/test_stock.py`
