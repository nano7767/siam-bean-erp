// Shapes returned by the API. Money is a string with two decimals, e.g. "9630.00".

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface Product {
  id: number
  sku: string
  name: string
  unit: string
  price: string
  cost: string
  reorder_level: number
  active: boolean
  on_hand: number
  low_stock: boolean
}

export interface Customer {
  id: number
  name: string
  tax_id: string
  address: string | null
  contact: string | null
  payment_terms_days: number
  active: boolean
}

export interface Movement {
  id: number
  product_id: number
  sku: string
  product_name: string
  unit: string
  quantity: number
  ref_doc: string
  note: string | null
  created_at: string
  created_by_name: string | null
}

export interface StockCardRow {
  id: number
  ref_doc: string
  quantity: number
  balance: number
  note: string | null
  created_at: string
  created_by_name: string | null
}

export type OrderStatus = 'draft' | 'confirmed' | 'paid' | 'cancelled'

export interface OrderLine {
  id: number
  product_id: number
  sku: string
  name: string
  unit: string
  quantity: number
  unit_price: string
  line_total: string
}

export interface Order {
  id: number
  number: string
  status: OrderStatus
  order_date: string
  note: string | null
  customer: { id: number; name: string; tax_id: string; payment_terms_days: number }
  lines: OrderLine[]
  subtotal: string
  vat: string
  total: string
  invoice: { id: number; number: string; status: InvoiceStatus } | null
  created_by_name: string | null
  created_at: string
}

export interface OrderRow {
  id: number
  number: string
  status: OrderStatus
  order_date: string
  customer_name: string
  total: string
  invoice_id: number | null
  invoice_number: string | null
}

export type InvoiceStatus = 'open' | 'paid' | 'cancelled'

export interface InvoiceRow {
  id: number
  number: string
  status: InvoiceStatus
  issue_date: string
  due_date: string
  overdue: boolean
  customer_name: string
  order_number: string
  subtotal: string
  vat: string
  total: string
  amount_paid: string
  amount_due: string
}

export interface Payment {
  id: number
  invoice_id: number
  invoice_number: string
  customer_name: string
  amount: string
  method: string
  reference: string | null
  paid_at: string
  created_by_name: string | null
}

export interface Invoice extends InvoiceRow {
  customer: {
    id: number
    name: string
    tax_id: string
    address: string | null
    payment_terms_days: number
  }
  company: { name: string; tax_id: string | null; address: string | null }
  order: { id: number; number: string; status: OrderStatus }
  lines: OrderLine[]
  payments: Payment[]
}

export interface Dashboard {
  date: string
  sales_today: string
  low_stock_count: number
  low_stock_products: {
    id: number
    sku: string
    name: string
    unit: string
    on_hand: number
    reorder_level: number
  }[]
  open_invoices_count: number
  open_invoices_amount: string
  overdue_invoices_count: number
  stock_value: string
  draft_orders_count: number
}
