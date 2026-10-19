# 07 Payments (US-4)

**Module:** Login and dashboard · **Owner:** _fill in_ · **Status:** done

## What
Accountant records a payment against an open invoice. When payments reach the total, the invoice and its order become Paid.

## Acceptance
- [x] Full payment of 9,630.00 on INV-0001 → status paid, dashboard open receivables drop by 9,630.00
- [x] Partial payment keeps it open with the amount due reduced
- [x] Paying more than is due → 422 with the amount due in the message
- [x] Paying a paid invoice → 409
- [x] Sales → 403

## Tests
`tests/test_payments.py`
