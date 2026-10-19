# Spec: Siam Bean Co. Mini ERP

Input: [docs/scenario.md](../../docs/scenario.md). Language: [GLOSSARY.md](../../GLOSSARY.md). The scenario wins when this spec disagrees with it.

## Problem

Siam Bean Co. runs on two spreadsheets and Word. Stock is always wrong, invoices take an hour each and get mixed up, nobody knows who still owes money, sales promise beans that are not there, and anyone can change anything.

## Solution

A web app with a login, where one confirmed sales order reduces stock and issues the invoice in one step, an accountant records payments against invoices, and the owner sees live numbers on a dashboard. Each staff member only does what their role allows, and the server enforces it.

## Decisions

| Question | Decision | Why |
| --- | --- | --- |
| Auth | Supabase Auth (email + password). The backend proxies login to Supabase and verifies every Bearer token with Supabase. | Never write our own password hashing. The frontend needs no Supabase key. |
| Where do roles live? | `users` table in Postgres: `id` = Supabase Auth user id, plus `company_id`, `role`, `active`. | Roles are per company and the API reads them on every request. |
| Where do business rules live? | FastAPI, one SQLAlchemy transaction per action. The frontend makes one call per action. | "Confirm" must be all or nothing. |
| Document numbers | `document_counters` table, one row per company and document type, incremented with `UPDATE … RETURNING` inside the same transaction. | Two users never get the same number, and a failed confirm does not burn a number. |
| Concurrency on stock | Confirm locks the product rows (`SELECT … FOR UPDATE`) before summing movements. | Two confirms on the same beans cannot both pass the check. |
| Stock on hand | Sum of `stock_movements.quantity`. No quantity column on products. | Business rule 3. |
| Order status | `draft → confirmed → paid`, or `draft → cancelled`. Confirm also issues the invoice (no delivery step). | Scope: quotations and deliveries are out. |
| Invoice status | `open → paid` when payments add up to the total. Partial payments allowed, overpayment rejected. | US-4. |
| VAT | `vat = round(subtotal × 0.07, 2)` half-up, `total = subtotal + vat`, all stored on the invoice. | Business rule 1. |
| "Today" | Asia/Bangkok date (UTC+7, no DST). | Sales today must match the owner's day. |
| Due date | Invoice date + customer payment terms (days). Cash = 0 days. | Scenario customers have 30 days, cash, 15 days. |
| Price changes | Only Admin edits product prices. The order line copies the price when the line is saved. | Scenario: Admin does "everything, including users and prices". |
| Multi-tenancy | Every business table has `company_id`; every query filters by the user's company. A second demo company proves separation. | Stretch goal, cheap if built from day one. |
| Database access | Only FastAPI talks to Postgres (direct connection). RLS is enabled with no policies, so the Supabase public API exposes nothing. | Course setup: "RLS on with no policy is fine". |

## Permission matrix (the test plan)

| Action | Admin | Sales | Warehouse | Accountant |
| --- | --- | --- | --- | --- |
| View dashboard | ✓ | ✓ | ✓ | ✓ |
| View products and on hand | ✓ | ✓ | ✓ | ✓ |
| Create, edit, deactivate products (incl. prices) | ✓ | – | – | – |
| View customers | ✓ | ✓ | – | ✓ |
| Create, edit, deactivate customers | ✓ | ✓ | – | – |
| Stock-in, adjustments, view stock card | ✓ | – | ✓ | – |
| View sales orders | ✓ | ✓ | – | ✓ |
| Create, edit, confirm, cancel sales orders | ✓ | ✓ | – | – |
| View invoices | ✓ | ✓ | – | ✓ |
| Accounting: record payments, view payments | ✓ | – | – | ✓ |
| Manage users | ✓ | – | – | – |

Anything not ticked returns **403** from the API, and the screen shows an access-denied page.

## API

All endpoints except `/health` and `/auth/*` need `Authorization: Bearer <access token>`. Errors are `{"detail": "<what to fix>"}`.

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| POST | `/auth/login` | public | `{email, password}` → `{access_token, refresh_token, user}` |
| POST | `/auth/refresh` | public | `{refresh_token}` → new tokens |
| GET | `/me` | any | current user, role and company |
| GET | `/dashboard` | any | `sales_today`, `low_stock_count`, `low_stock_products`, `open_invoices_count`, `open_invoices_amount`, `stock_value` |
| GET | `/products?q=&page=&include_inactive=` | any | 20 per page, each row has `on_hand` and `low_stock` |
| POST | `/products` | admin | 409 on duplicate SKU, 422 on negative price |
| PATCH | `/products/{id}` | admin | edit fields or `active: false` |
| GET | `/products/{id}/movements` | admin, warehouse | stock card with running balance |
| GET | `/customers?q=&page=&include_inactive=` | admin, sales, accountant | search by name or tax ID, 20 per page |
| POST | `/customers` | admin, sales | tax ID: 13 digits, required |
| PATCH | `/customers/{id}` | admin, sales | |
| GET | `/stock/movements` | admin, warehouse | latest movements |
| POST | `/stock/movements` | admin, warehouse | `{product_id, kind: "in" \| "adjust", quantity, note}`; in > 0; adjust ≠ 0 and never below zero |
| GET | `/orders?status=` | admin, sales, accountant | |
| POST | `/orders` | admin, sales | `{customer_id, lines: [{product_id, quantity}]}` → draft SO-000x |
| GET | `/orders/{id}` | admin, sales, accountant | lines, totals, invoice link |
| PUT | `/orders/{id}` | admin, sales | draft only |
| POST | `/orders/{id}/confirm` | admin, sales | 409 `Not enough stock for ARB-1KG …` and nothing changes |
| POST | `/orders/{id}/cancel` | admin, sales | draft only |
| GET | `/invoices?status=` | admin, sales, accountant | |
| GET | `/invoices/{id}` | admin, sales, accountant | lines, customer, payments, `amount_due` |
| POST | `/invoices/{id}/payments` | admin, accountant | `{amount, method, reference}`; marks Paid when fully paid |
| GET | `/payments` | admin, accountant | the Accounting screen |
| GET | `/users` | admin | |
| POST | `/users` | admin | creates the Supabase Auth user and the role row |
| PATCH | `/users/{id}` | admin | change role or deactivate |

## Non-functional requirements

1. **Security:** every role rule is enforced by the API (403), checked by automated tests per row of the matrix. No secret key in git or in the frontend bundle.
2. **Speed:** customer search answers within 1 second for 200 customers and returns at most 20 rows per page (US-5).
3. **Reliability:** confirming an order either creates all stock movements and the invoice, or nothing (tested with an order where only the second line is short).
4. **Availability:** public HTTPS URL that works on a 375 px wide phone screen.

## Out of scope

Quotations, delivery notes, purchasing, HR, withholding tax, multiple warehouses, LINE integration.

## Stretch goals we build

1. **Printable PDF invoice** with company header, tax IDs and VAT (browser print → Save as PDF).
2. **Multi-tenancy**: a second company (Chiang Mai Bakery) with its own admin and data; Siam Bean users never see it.
