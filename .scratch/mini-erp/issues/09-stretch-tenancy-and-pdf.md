# 09 Stretch: second company and printable invoice

**Module:** all · **Owner:** _fill in_ · **Status:** done

## What
1. A second company (Chiang Mai Bakery) with its own admin. Every query filters by `company_id`.
2. Invoice page prints as a clean A4 tax invoice (company header, tax IDs, VAT) → Save as PDF.

## Acceptance
- [x] The bakery admin sees none of Siam Bean's products, customers, orders or invoices, and gets 404 on their ids
- [x] Document numbers are per company: the bakery's first invoice is also INV-0001
- [x] Print preview shows only the invoice

## Tests
`tests/test_tenancy.py`
