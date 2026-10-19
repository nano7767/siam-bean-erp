# Class 4 demo script (Thu 22 Oct 2026, 17:00)

10 minutes, hard stop: 1 min problem · 6 min live demo · 3 min Q&A. Rehearse with a timer. Every member speaks at least once.

## Before 17:00

- [ ] `cd backend && uv run seed.py --reset`. ARB-1KG is back at **170 kg** and the next invoice is **INV-0001**
- [ ] Two browser windows on the **deployed URL** (not localhost): window A logged in as **Sales (Nok)**, window B logged in as **Accountant (Fon)**
- [ ] Third tab: GitHub repo (README, commit history); fourth tab: Supabase Table Editor (`invoices`, `stock_movements`)
- [ ] Phone ready with the URL open on mobile data
- [ ] Backup: screenshots / screen recording of the whole flow in case the network fails

## Minute 0–1: the problem (speaker 1)

> Siam Bean Co. sells 1 kg bags of coffee to about 80 cafés. Orders come by LINE, sales retype them into a spreadsheet, stock lives in another sheet that is always wrong, invoices are typed in Word and numbered by hand, and nobody knows who still owes money. We built one system where confirming an order moves the stock and issues the invoice in one step, every role only does what it is allowed to, and the owner sees live numbers.

## Minute 1–7: live demo (speakers 2 and 3)

| # | Window | Do | Say / point at |
|---|--------|----|----------------|
| 1 | A (Sales, Nok) | Dashboard | Sales today 0.00, Open invoices 0.00, **Low stock 1** (ROB-1KG 35 < 40: US-2), Stock value |
| 2 | A | Products | **ARB-1KG on hand 170 kg**; ROB-1KG has the Low stock badge |
| 3 | A | Sales orders → New → type "lune" → Café Lune → ARB-1KG, **20** | Price 450 is copied from the product; totals 9,000 + 630 VAT = **9,630.00 THB** |
| 4 | A | Save draft → **Confirm order** → Confirm and issue invoice | "One transaction: stock movement and invoice together." |
| 5 | A | Products | **ARB-1KG 150 kg** (Stock card shows `SO-0001 −20 → 150`) |
| 6 | A | Open invoice **INV-0001** | 9,000.00 + 630.00 = **9,630.00 THB**, due in 30 days |
| 7 | A | Rule failing: New order, Café Lune, ARB-1KG **200** → Save → Confirm | The form already warns; the server answers **"Not enough stock for ARB-1KG"**; stock still 150 |
| 8 | A | Type `/accounting` in the address bar | **403 Access denied**: Sales cannot see Accounting (US-3) |
| 9 | B (Accountant, Fon) | Accounting → INV-0001 → Record payment 9,630.00 | Invoice becomes **Paid** (US-4) |
| 10 | B | Dashboard (Refresh) | **Sales today 9,630.00**, **Open invoices 0.00**: numbers agree on every screen |
| 11 | Any | (optional, 30 s) Log in as Warehouse, open Sales orders | **403** again; mention `test_roles.py` calls the confirm API as Warehouse and gets 403 |
| 12 | Any | (bonus, 30 s) Print / Save PDF on INV-0001; log in as the bakery admin | Stretch goals: PDF tax invoice, second company sees none of Siam Bean's data |

## Minute 7–10: Q&A (anyone)

Likely questions and where to point:

| Question | Answer / show |
|---|---|
| How do you stop two people selling the same beans? | `confirm_order` locks the product rows (`SELECT … FOR UPDATE`) and checks inside one transaction. [ADR 0001](adr/0001-confirm-order-in-one-transaction.md). Tested on Postgres: two 100 kg confirms with 170 on hand → one succeeds. |
| Where is stock stored? | Nowhere as a number: `SUM(stock_movements.quantity)`. Show `stock_movements` in Supabase. |
| How are roles enforced? | `Depends(require("admin", "sales"))` on every endpoint, role read from our `users` table after Supabase verifies the token. `tests/test_roles.py` = the permission matrix. |
| How are invoice numbers generated? | `document_counters` row updated inside the same transaction; a failed confirm rolls it back, so no gaps. |
| What if the product price changes? | `order_items.unit_price` and the invoice totals are copies. Test: `test_price_change_after_confirm_does_not_change_the_invoice`. |
| Show the tests / were they first? | `git log --oneline`: first commit is the failing tests; `uv run pytest` → 155 passed. |
| Where is the spec? | `.scratch/mini-erp/spec.md`, tickets in `.scratch/mini-erp/issues/`, `GLOSSARY.md`. |
