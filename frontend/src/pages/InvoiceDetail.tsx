import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { post } from '../api'
import { useAuth } from '../auth'
import { Icon } from '../components/icons'
import { notify } from '../components/toast'
import { Badge, DocFlow, ErrorBox, Field, LoadError, Loading, PageHeader } from '../components/ui'
import { amount, dateTime, day, METHOD_LABEL, terms, thb } from '../format'
import type { Invoice } from '../types'
import { useApi } from '../useApi'
import { LinesTable, saleFlow } from './OrderDetail'

export function InvoiceDetail() {
  const { id } = useParams()
  const { can } = useAuth()
  const { data: invoice, error, reload } = useApi<Invoice>(`/invoices/${id}`)

  if (error) return <LoadError error={error} />
  if (!invoice) return <Loading />

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={`Invoice ${invoice.number}`}
          icon="invoice"
          subtitle={
            <>
              {invoice.overdue ? <Badge status="overdue">Overdue</Badge> : <Badge status={invoice.status} />} · from order{' '}
              <Link to={`/orders/${invoice.order.id}`}>{invoice.order.number}</Link>
            </>
          }
          actions={
            <button type="button" className="button secondary" onClick={() => window.print()}>
              <Icon name="printer" size={16} />
              Print / Save PDF
            </button>
          }
        />
        <DocFlow
          steps={saleFlow({
            orderNumber: invoice.order.number,
            orderStatus: invoice.order.status,
            orderDate: invoice.issue_date,
            invoice: { number: invoice.number, status: invoice.status },
          })}
        />
      </div>

      <div className="layout-invoice">
        <article className="card invoice-paper">
          <header className="invoice-head">
            <div>
              <h2>{invoice.company.name}</h2>
              {invoice.company.address && <p className="small">{invoice.company.address}</p>}
              {invoice.company.tax_id && <p className="small">Tax ID {invoice.company.tax_id}</p>}
            </div>
            <div className="invoice-title">
              <h2>TAX INVOICE</h2>
              <p className="mono strong">{invoice.number}</p>
              <p className="small">Issued {day(invoice.issue_date)}</p>
              <p className="small">Due {day(invoice.due_date)}</p>
            </div>
          </header>
          <div className="doc-parties">
            <div>
              <span className="muted small">Bill to</span>
              <strong>{invoice.customer.name}</strong>
              {invoice.customer.address && <span className="small">{invoice.customer.address}</span>}
              <span className="small">Tax ID {invoice.customer.tax_id}</span>
            </div>
            <div>
              <span className="muted small">Reference</span>
              <span className="small">Sales order {invoice.order.number}</span>
              <span className="small">Payment terms: {terms(invoice.customer.payment_terms_days)}</span>
            </div>
          </div>
          <LinesTable order={invoice} />
          <dl className="totals paid-summary">
            <dt>Paid</dt>
            <dd>{thb(invoice.amount_paid)}</dd>
            <dt className="grand">Still due</dt>
            <dd className="grand">{thb(invoice.amount_due)}</dd>
          </dl>
          {invoice.status === 'paid' && <div className="paid-stamp">PAID</div>}
        </article>

        <aside className="no-print">
          {invoice.status === 'open' && can('admin', 'accountant') && (
            <PaymentForm key={invoice.amount_due} invoice={invoice} onSaved={reload} />
          )}
          {invoice.status === 'open' && !can('admin', 'accountant') && (
            <div className="info-box">Only Admin and Accountant can record payments.</div>
          )}
          <div className="card">
            <h2>Payments</h2>
            {invoice.payments.length === 0 ? (
              <p className="muted">No payments recorded yet.</p>
            ) : (
              <ul className="plain-list">
                {invoice.payments.map((p) => (
                  <li key={p.id}>
                    <div>
                      <strong>{thb(p.amount)}</strong>
                      <div className="muted small">
                        {METHOD_LABEL[p.method] ?? p.method}
                        {p.reference && ` · ${p.reference}`}
                      </div>
                    </div>
                    <div className="muted small row-end">
                      {dateTime(p.paid_at)} · {p.created_by_name}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}

function PaymentForm({ invoice, onSaved }: { invoice: Invoice; onSaved: () => void }) {
  const [value, setValue] = useState(invoice.amount_due)
  const [method, setMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!(Number(value) > 0)) return setError('Amount must be greater than zero')
    setBusy(true)
    setError(null)
    try {
      const result = await post<{ invoice: { status: string } }>(`/invoices/${invoice.id}/payments`, {
        amount: value,
        method,
        reference,
      })
      notify(result.invoice.status === 'paid' ? `${invoice.number} is now paid` : `Payment of ${thb(value)} recorded`)
      setReference('')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h2>Record a payment</h2>
      <ErrorBox error={error} />
      <Field label="Amount (THB)" hint={`Still due: ${amount(invoice.amount_due)} THB`}>
        <input type="number" min="0.01" step="0.01" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <Field label="Method">
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          {Object.entries(METHOD_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Reference (optional)">
        <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="KBank transfer 14:32" />
      </Field>
      <button type="submit" className="button" disabled={busy}>
        {busy ? 'Saving…' : 'Record payment'}
      </button>
    </form>
  )
}
