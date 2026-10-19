import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { post } from '../api'
import { useAuth } from '../auth'
import { notify } from '../components/toast'
import { Badge, ErrorBox, LoadError, Loading, Modal, PageHeader } from '../components/ui'
import { day, qty, terms, thb } from '../format'
import type { Order } from '../types'
import { useApi } from '../useApi'

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
                Edit
              </Link>
              <button type="button" className="button" onClick={() => setAsking(true)} disabled={busy}>
                Confirm order
              </button>
            </>
          )
        }
      />
      <ErrorBox error={actionError} />
      {issued && (
        <div className="success-box">
          <strong>Order confirmed.</strong> Stock has been reduced and invoice{' '}
          <Link to={`/invoices/${issued.id}`}>{issued.number}</Link> was issued for {thb(issued.total)}.
          <Link to={`/invoices/${issued.id}`} className="button small">
            Open {issued.number} →
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
            <th>SKU</th>
            <th>Product</th>
            <th className="num">Qty</th>
            <th className="num">Unit price</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={l.id}>
              <td className="mono">{l.sku}</td>
              <td>{l.name}</td>
              <td className="num">
                {qty(l.quantity)} {l.unit}
              </td>
              <td className="num">{thb(l.unit_price)}</td>
              <td className="num">{thb(l.line_total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="num">
              Subtotal
            </td>
            <td className="num">{thb(order.subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="num">
              VAT 7%
            </td>
            <td className="num">{thb(order.vat)}</td>
          </tr>
          <tr className="grand">
            <td colSpan={4} className="num">
              Total
            </td>
            <td className="num">{thb(order.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
