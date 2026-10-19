# The scenario: Siam Bean Co.

> Copied from the CU FDE3 workshop worksheet. This is the input to the agent. Do not invent a business: the scenario wins.

## Company

- Siam Bean Co. is a small coffee-bean distributor in Bangkok
- It imports and roasts beans, then sells 1 kg bags to about 80 cafés
- 5 staff, one office and one warehouse
- Today: orders come by LINE and phone, sales retype them into a spreadsheet, stock is in another sheet, invoices are made in Word and numbered by hand

## Users and roles

| Who          | Role          | Can do                                                          |
| ------------ | ------------- | --------------------------------------------------------------- |
| Khun Somchai | Admin (owner) | Everything, including users and prices                          |
| Nok, Ploy    | Sales         | Edit customers, create and confirm sales orders, view invoices  |
| Lek          | Warehouse     | Stock in, stock out, adjustments. View products.                |
| Fon          | Accountant    | Invoices and payments. View products and customers.             |

- Everyone can see the dashboard

## Pain points (owner's words)

1. "Stock in the sheet is always wrong."
2. "Each invoice takes me an hour and the numbers get mixed up."
3. "I never know who still owes me money."
4. "Sales sometimes promise beans we don't have."
5. "Anyone can change anything in the spreadsheet."

## Scope

- In scope (must have)
  - Login with roles
  - Products and customers: create, list, edit, deactivate
  - Stock: stock-in form, stock goes down when an order is confirmed, low-stock alert
  - Sales order → invoice with 7% VAT
  - Record a payment against an invoice
  - Dashboard with at least 3 live numbers
  - Deployed with a public URL
- Out of scope (do not build unless it is your bonus)
  - Quotations and delivery notes
  - Purchasing (purchase orders, goods receipts): bonus only
  - More than one company: bonus only
  - HR and payroll, withholding tax, multiple warehouses, LINE integration

## User stories (given: do not rewrite them, build them)

- **US-1 Sales order → invoice.** As a sales staff, I want to create and confirm a sales order for a café so that stock is reserved and an invoice is issued.
  - Given 170 kg of ARB-1KG on hand, when I confirm an order for Café Lune of 20 kg at 450 THB, then on hand shows 150 kg and INV-0001 shows 9,000 + 630 VAT = 9,630 THB
  - Given a line quantity greater than stock on hand, when I confirm, then I see "Not enough stock for ARB-1KG" and nothing changes
- **US-2 Low stock.** As a warehouse staff, I want to see which products are low on stock so that I can reorder in time.
  - Given a product below its reorder level, when I open the product list, then it shows a low-stock badge and the dashboard low-stock count includes it
- **US-3 Roles.** As the owner, I want each user to have a role so that they only see and do what they are allowed to.
  - Given a Sales user, when they open the Accounting screen, then they see an access-denied page and the API returns 403
  - Given a Warehouse user, when they call the confirm-order API directly, then it returns 403
  - Given an Admin, when they open the same screens, then they load
- **US-4 Payment.** As an accountant, I want to record a payment against an invoice so that I know what is still owed.
  - Given open invoice INV-0001 of 9,630 THB, when I record a full payment, then its status becomes Paid and open receivables on the dashboard drop by 9,630 THB
- **US-5 Search.** As a sales staff, I want to search customers so that I find one quickly.
  - Given 200 customers, when I type part of a name, then the list filters within 1 second and shows at most 20 rows per page

## Sample master data

Master data = the things the business deals with: products, customers, suppliers. Load these as your test data.

### Products

| SKU     | Name                  | Unit | Cost (THB) | Price (THB) | Reorder level | Opening stock |
| ------- | --------------------- | ---- | ---------- | ----------- | ------------- | ------------- |
| ARB-1KG | Arabica, 1 kg bag     | kg   | 320        | 450         | 50            | 170           |
| ROB-1KG | Robusta, 1 kg bag     | kg   | 220        | 320         | 40            | 35            |
| BLD-1KG | House Blend, 1 kg bag | kg   | 260        | 380         | 30            | 90            |
| DRP-10  | Drip bags, box of 10  | box  | 90         | 150         | 100           | 240           |

### Customers

| Name                  | Tax ID (fictional) | Payment terms |
| --------------------- | ------------------ | ------------- |
| Café Lune             | 0105561000011      | 30 days       |
| Brew Lab Ari          | 0105562000022      | Cash          |
| Sukhumvit Corner Café | 0105563000033      | 15 days       |

### Suppliers (only needed for the purchasing bonus)

| Name                | Lead time | Payment terms | Location   |
| ------------------- | --------- | ------------- | ---------- |
| Doi Chang Farm      | 7 days    | 30 days       | Chiang Rai |
| Nan Highland Coffee | 14 days   | 60 days       | Nan        |

- ROB-1KG starts below its reorder level on purpose: US-2 should show it as low stock

## Business rules

1. VAT is 7%. Store the unit price without VAT on the order line. The invoice stores subtotal, VAT and total.
2. Stock can never go negative. Confirming an order with too little stock fails and changes nothing.
3. Stock on hand = the sum of stock movements (+ in, − out). Nobody types the stock number.
4. Document numbers are sequential and never reused: SO-0001 (sales order), INV-0001 (invoice), PO-0001 (purchase order, bonus)
5. Confirming an order creates the stock movements and the invoice together, in one transaction (all or nothing)
6. The price is copied onto the order line. Changing a product price never changes old orders or invoices.
7. Products and customers with documents are deactivated, never deleted
8. Roles are checked on the server: the API returns 403 for the wrong role, even if the button is hidden
9. Validation: price ≥ 0, quantity above 0, SKU unique, customer tax ID required

## Success criteria

- Café Lune's 20 kg order goes from order → stock → invoice → payment → dashboard on the live URL, and the numbers agree on every screen
- A Warehouse user cannot confirm an order, even by calling the API
- The owner sees today's sales, low-stock count and open invoices on the dashboard without asking anyone
