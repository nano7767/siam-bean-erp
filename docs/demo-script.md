# Class 4 demo script (Thu 22 Oct 2026, 17:00)

Solo presenter. 10 minutes, hard stop: 1 min problem · 6 min live demo · 3 min Q&A. Rehearse with a timer at least twice; if a run goes over 7 minutes, drop the optional steps 11–12 first.

## Before 17:00

- [ ] `cd backend && uv run seed.py --reset`. ARB-1KG is back at **170 kg** and the next invoice is **INV-0001**
- [ ] Two browser windows on the **deployed URL** (not localhost), side by side: window A logged in as **Sales (Nok)**, window B logged in as **Accountant (Fon)**. Logging in before you start saves a minute.
- [ ] Extra tabs: GitHub repo (README, commit history), Supabase Table Editor (`invoices`, `stock_movements`), VS Code with the repo open
- [ ] Phone with the URL open on mobile data
- [ ] Backup: screenshots or a screen recording of the whole flow in case the network fails

## 0:00–1:00 · The problem

> Siam Bean Co. is a coffee-bean distributor in Bangkok selling 1 kg bags to about 80 cafés. Today orders come by LINE, sales retype them into a spreadsheet, stock lives in another sheet that is always wrong, invoices are typed in Word and numbered by hand, and nobody knows who still owes money.
>
> I built one system on one database: confirming an order takes the stock out and issues the invoice in a single step, each of the four roles can only do what it is allowed to (checked by the server), and the owner sees live numbers on a dashboard. Let me show you Café Lune's order end to end.

## 1:00–7:00 · Live demo

| Time | # | Window | Do | Say |
|------|---|--------|----|-----|
| 1:00 | 1 | A (Sales, Nok) | Dashboard | "I'm logged in as Nok from Sales. Sales today is zero, nothing is owed, and one product is low on stock: Robusta, 35 kg against a reorder level of 40. That's US-2." |
| 1:30 | 2 | A | Products | "Arabica, ARB-1KG, has **170 kg** on hand. Nobody types that number: it's the sum of every stock movement." |
| 2:00 | 3 | A | Sales orders → New → type "lune" → Café Lune → ARB-1KG, quantity **20** | "Café Lune orders 20 kg. The price, 450, is copied from the product, so a later price change never touches this order. 9,000 plus 7% VAT is **9,630 THB**." |
| 2:45 | 4 | A | Save draft → **Confirm order** → Confirm and issue invoice | "It's a draft until I confirm. Confirm runs one database transaction: it checks stock, takes 20 kg out and creates the invoice, all or nothing." |
| 3:15 | 5 | A | Products → ARB-1KG → Stock card | "Stock went from 170 to **150**, and the stock card shows the movement from SO-0001." |
| 3:45 | 6 | A | Open invoice **INV-0001** | "The invoice was numbered by the server: INV-0001, the same lines, 9,000 plus 630 VAT, **9,630 THB**, due in 30 days because Café Lune has 30-day terms." |
| 4:15 | 7 | A | New order, Café Lune, ARB-1KG **200** → Save → Confirm | "Now a rule failing: 200 kg when we only have 150. The form warns me, and the server refuses: **'Not enough stock for ARB-1KG'**. Nothing changed; stock is still 150." |
| 5:00 | 8 | A | Type `/accounting` in the address bar | "Sales is not allowed to see Accounting. The server answers **403** and the app shows access denied. That's US-3." |
| 5:30 | 9 | B (Accountant, Fon) | Accounting → INV-0001 → Record payment 9,630.00 | "Now as Fon, the accountant: Café Lune pays the full amount, and INV-0001 becomes **Paid**. That's US-4." |
| 6:00 | 10 | B | Dashboard → Refresh | "Back on the dashboard: sales today **9,630**, open invoices back to **zero**. The same numbers on every screen, computed live." |
| 6:20 | 11 | B | *(optional)* Log out → Warehouse → open Sales orders | "Warehouse can't touch orders either: 403. My tests call the confirm API directly as Warehouse and expect 403." |
| 6:40 | 12 | B | *(optional)* Print / Save PDF on INV-0001 | "Two bonus features: the invoice prints as a PDF tax invoice, and a second company, Chiang Mai Bakery, shares the app but can't see any of Siam Bean's data." |
| 7:00 | | | Stop | "That's the full flow. Happy to take questions." |

## 7:00–10:00 · Q&A

Likely questions and what to show:

| Question | Answer / show |
|---|---|
| How do you stop two people selling the same beans? | `confirm_order` in `backend/erp/routers/orders.py` locks the product rows (`SELECT … FOR UPDATE`) and checks inside one transaction. [ADR 0001](adr/0001-confirm-order-in-one-transaction.md). I tested it on Postgres: two 100 kg confirms at the same moment with 170 on hand, and exactly one succeeds. |
| Where is stock stored? | Nowhere as a number: it's `SUM(stock_movements.quantity)`. Show `stock_movements` in Supabase. |
| How are roles enforced? | `Depends(require("admin", "sales"))` on every endpoint. Supabase verifies the login token, then the role comes from my `users` table. `tests/test_roles.py` checks the whole permission matrix. |
| How are invoice numbers generated? | A `document_counters` row is incremented inside the same transaction, so a failed confirm rolls it back and no number is wasted. |
| What if a product price changes? | The order line and the invoice store their own copies. Test: `test_price_change_after_confirm_does_not_change_the_invoice`. |
| Show the tests. Were they written first? | `git log --oneline`: the first commit is the failing tests. `uv run pytest` → 155 passed. |
| Where is the spec? | `.scratch/mini-erp/spec.md`, tickets in `.scratch/mini-erp/issues/`, plus `GLOSSARY.md`. |
| Does the ER diagram match the database? | README diagram next to the Supabase Table Editor; the tables come from `backend/erp/models.py`. |
