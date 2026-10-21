import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { post } from '../api'
import { useAuth } from '../auth'
import { Icon } from '../components/icons'
import { notify } from '../components/toast'
import { Badge, DocFlow, ErrorBox, LoadError, Loading, Modal, PageHeader, type FlowStep } from '../components/ui'
import { amount, day, qty, terms, thb } from '../format'
import type { InvoiceStatus, Order, OrderStatus } from '../types'
import { useApi } from '../useApi'

/** Draft → Confirmed (stock out) → Invoiced → Paid, shared by the order and invoice pages. */
// eslint-disable-next-line react-refresh/only-export-components
export function saleFlow(sale: {
  orderNumber: string
  orderStatus: OrderStatus
  orderDate: string
  invoice: { number: string; status: InvoiceStatus } | null
}): FlowStep[] {
  const confirmed = sale.orderStatus === 'confirmed' || sale.orderStatus === 'paid'
  const paid = sale.orderStatus === 'paid' || sale.invoice?.status === 'paid'
  const steps: FlowStep[] = [
    { label: 'Draft', detail: `${sale.orderNumber} · ${day(sale.orderDate)}`, done: true },
    { label: 'Confirmed', detail: confirmed ? 'Stock taken out' : 'Checks and moves stock', done: confirmed },
    { label: 'Invoiced', detail: sale.invoice ? `${sale.invoice.number} · 7% VAT` : 'Issued on confirm', done: !!sale.invoice },
    { label: 'Paid', detail: paid ? 'Receivable cleared' : 'Waiting for payment', done: paid },
  ]
  const next = steps.find((step) => !step.done)
  if (next && sale.orderStatus !== 'cancelled') next.current = true
  return steps
}

interface ConfirmResult {
  order: Order
  invoice: { id: number; number: string; total: string }
}

export function OrderDetail() {
  const { id } = useParams()
  const { can } = useAuth()
  const { data: order, error, reload } = useApi<Order>(`/orders/${id}`)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [issued, setIssued] = useState<ConfirmResult['invoice'] | null>(null)

  if (error) return <LoadError error={error} />
  if (!order) return <Loading />

  const editable = order.status === 'draft' && can('admin', 'sales')

  async function confirm() {
    setBusy(true)
    setActionError(null)
    try {
      const result = await post<ConfirmResult>(`/orders/${id}/confirm`)
      setIssued(result.invoice)
      notify(`${order!.number} confirmed · ${result.invoice.number} issued`)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      setAsking(false)
    }
  }

  async function cancel() {
    if (!window.confirm(`Cancel ${order!.number}? The number will not be reused.`)) return
    setActionError(null)
    try {
      await post(`/orders/${id}/cancel`)
      notify(`${order!.number} cancelled`)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <PageHeader
        title={`Sales order ${order.number}`}
        icon="orders"
        subtitle={
          <>
            <Badge status={order.status} /> · {day(order.order_date)} · created by {order.created_by_name}
          </>
        }
        actions={
          editable && (
            <>
              <button type="button" className="button ghost" onClick={cancel}>
                Cancel order
              </button>
              <Link to={`/orders/${order.id}/edit`} className="button secondary">
                <Icon name="edit" size={16} />
                Edit
              </Link>
              <button type="button" className="button" onClick={() => setAsking(true)} disabled={busy}>
                <Icon name="check" size={16} />
                Confirm order
              </button>
            </>
          )
        }
      />
      <DocFlow
        cancelled={order.status === 'cancelled'}
        steps={saleFlow({ orderNumber: order.number, orderStatus: order.status, orderDate: order.order_date, invoice: order.invoice })}
      />
      <ErrorBox error={actionError} />
      {issued && (
        <div className="success-box">
          <Icon name="check" size={18} strokeWidth={2.5} />
          <span>
            <strong>Order confirmed.</strong> Stock has been reduced and invoice{' '}
            <Link to={`/invoices/${issued.id}`}>{issued.number}</Link> was issued for {thb(issued.total)}.
          </span>
          <Link to={`/invoices/${issued.id}`} className="button small">
            Open {issued.number} <Icon name="arrowRight" size={14} />
          </Link>
        </div>
      )}
      {!issued && order.invoice && (
        <div className="info-box">
          Invoice <Link to={`/invoices/${order.invoice.id}`}>{order.invoice.number}</Link> · <Badge status={order.invoice.status} />
        </div>
      )}

      <div className="card">
        <div className="doc-parties">
          <div>
            <span className="muted small">Customer</span>
            <strong>{order.customer.name}</strong>
            <span className="small">Tax ID {order.customer.tax_id}</span>
            <span className="small">Payment terms: {terms(order.customer.payment_terms_days)}</span>
          </div>
          {order.note && (
            <div>
              <span className="muted small">Note</span>
              <span>{order.note}</span>
            </div>
          )}
        </div>
        <LinesTable order={order} />
      </div>

      {asking && (
        <Modal title={`Confirm ${order.number}?`} onClose={() => setAsking(false)}>
          <p>This will, in one step:</p>
          <ul>
            {order.lines.map((l) => (
              <li key={l.id}>
                take <strong>{qty(l.quantity)} {l.unit}</strong> of {l.sku} out of stock
              </li>
            ))}
            <li>
              issue an invoice to <strong>{order.customer.name}</strong> for <strong>{thb(order.total)}</strong> (incl. 7% VAT)
            </li>
          </ul>
          <p className="muted small">If any product does not have enough stock, nothing changes.</p>
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={() => setAsking(false)}>
              Back
            </button>
            <button type="button" className="button" onClick={confirm} disabled={busy}>
              {busy ? 'Confirming…' : 'Confirm and issue invoice'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

export function LinesTable({ order }: { order: Pick<Order, 'lines' | 'subtotal' | 'vat' | 'total'> }) {
  return (
    <div className="table-wrap">
      <table className="lines">
        <thead>
          <tr>
            <th>Product</th>
            <th className="num">Qty</th>
            <th className="num">Unit price (THB)</th>
            <th className="num">Amount (THB)</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={l.id}>
              <td>
                <span className="line-product">
                  <strong>{l.name}</strong>
                  <span className="mono muted">{l.sku}</span>
                </span>
              </td>
              <td className="num">
                {qty(l.quantity)} {l.unit}
              </td>
              <td className="num">{amount(l.unit_price)}</td>
              <td className="num">{amount(l.line_total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="num">
              Subtotal
            </td>
            <td className="num">{amount(order.subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={3} className="num">
              VAT 7%
            </td>
            <td className="num">{amount(order.vat)}</td>
          </tr>
          <tr className="grand">
            <td colSpan={3} className="num">
              Total
            </td>
            <td className="num">{thb(order.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
