# 0001 Confirm order runs in one FastAPI transaction with row locks

**Status:** accepted

## Context
Business rules 2 and 5: stock can never go negative, and confirming creates the stock movements and the invoice together, all or nothing. Two sales staff may confirm orders for the same beans at the same moment.

## Decision
`POST /orders/{id}/confirm` does everything in one SQLAlchemy session and commits once at the end:
1. `SELECT … FOR UPDATE` the order (must be draft) and the products on it, in id order.
2. Sum the stock movements per product and compare with the order (lines for the same product are added up).
3. Insert one negative movement per line (`ref_doc` = SO number), set the order to confirmed.
4. Take the next INV number from `document_counters` (`UPDATE … RETURNING`, locks the counter row) and insert the invoice.

Any error raises before the commit; the session closes and rolls back, so nothing changes and no number is used up.

## Consequences
- The frontend makes one call; it can never leave stock moved without an invoice.
- Verified on Postgres 16: two simultaneous 100 kg confirms with 170 kg on hand → one 200, one 409, on hand 70.
- Business logic lives in Python (testable with pytest) rather than a Postgres function.
