import { Link } from 'react-router'
import { Icon } from '../components/icons'
import { LoadError, Loading, PageHeader, Empty } from '../components/ui'
import { dateTime, METHOD_LABEL, thb } from '../format'
import type { InvoiceRow, Payment } from '../types'
import { useApi } from '../useApi'
import { InvoiceTable } from './Invoices'

/** Admin and Accountant only. Every other role gets 403 from GET /payments and sees Access denied. */
export function Accounting() {
  const payments = useApi<Payment[]>('/payments')
  const open = useApi<InvoiceRow[]>(payments.error ? null : '/invoices?status=open')

  if (payments.error) return <LoadError error={payments.error} />
  if (!payments.data) return <Loading />

  const owed = (open.data ?? []).reduce((sum, i) => sum + Number(i.amount_due), 0)

  return (
    <>
      <PageHeader icon="wallet" title="Accounting" subtitle="Who still owes us money, and what has been paid." />
      <section className="tiles tiles-2">
        <div className="tile tile-warn">
          <span className="tile-icon tone-warn">
            <Icon name="invoice" size={20} />
          </span>
          <span className="tile-label">Open receivables</span>
          <span className="tile-value">{thb(owed)}</span>
          <span className="tile-note">{open.data?.length ?? 0} unpaid invoices</span>
        </div>
        <div className="tile tile-good">
          <span className="tile-icon tone-good">
            <Icon name="wallet" size={20} />
          </span>
          <span className="tile-label">Payments recorded</span>
          <span className="tile-value">{payments.data.length}</span>
          <span className="tile-note">Latest first below</span>
        </div>
      </section>

      <h2>Unpaid invoices</h2>
      <p className="muted small">Open an invoice to record a payment against it.</p>
      <LoadError error={open.error} />
      {open.data && open.data.length === 0 && <Empty>Nobody owes us money right now.</Empty>}
      {open.data && open.data.length > 0 && <InvoiceTable rows={open.data} />}

      <h2>Payments</h2>
      {payments.data.length === 0 ? (
        <Empty>No payments recorded yet.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Method</th>
                <th className="num">Amount</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {payments.data.map((p) => (
                <tr key={p.id}>
                  <td>{dateTime(p.paid_at)}</td>
                  <td>
                    <Link to={`/invoices/${p.invoice_id}`} className="mono">
                      {p.invoice_number}
                    </Link>
                  </td>
                  <td>{p.customer_name}</td>
                  <td>
                    {METHOD_LABEL[p.method] ?? p.method}
                    {p.reference && <div className="muted small">{p.reference}</div>}
                  </td>
                  <td className="num strong">{thb(p.amount)}</td>
                  <td>{p.created_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
