import { Link, useSearchParams } from 'react-router'
import { query } from '../api'
import { Badge, Empty, LoadError, Loading, PageHeader } from '../components/ui'
import { day, thb } from '../format'
import type { InvoiceRow } from '../types'
import { useApi } from '../useApi'

export function Invoices() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const { data, error, loading } = useApi<InvoiceRow[]>(`/invoices${query({ status })}`)

  if (error?.status === 403) return <LoadError error={error} />

  return (
    <>
      <PageHeader title="Invoices" subtitle="Issued automatically when a sales order is confirmed." />
      <div className="tabs">
        {[
          ['', 'All'],
          ['open', 'Open'],
          ['paid', 'Paid'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={status === value ? 'tab active' : 'tab'}
            onClick={() => setParams(value ? { status: value } : {})}
          >
            {label}
          </button>
        ))}
      </div>
      <LoadError error={error} />
      {!data && loading && <Loading />}
      {data && data.length === 0 && (
        <Empty>{status === 'open' ? 'Nobody owes us money right now.' : 'No invoices yet. Confirm a sales order to issue one.'}</Empty>
      )}
      {data && data.length > 0 && <InvoiceTable rows={data} />}
    </>
  )
}

export function InvoiceTable({ rows }: { rows: InvoiceRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Issued</th>
            <th>Due</th>
            <th>Customer</th>
            <th className="num">Total</th>
            <th className="num">Still due</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id}>
              <td>
                <Link to={`/invoices/${i.id}`} className="mono strong">
                  {i.number}
                </Link>
                <div className="muted small">{i.order_number}</div>
              </td>
              <td>{day(i.issue_date)}</td>
              <td className={i.overdue ? 'text-bad' : ''}>{day(i.due_date)}</td>
              <td>{i.customer_name}</td>
              <td className="num">{thb(i.total)}</td>
              <td className="num strong">{thb(i.amount_due)}</td>
              <td>
                {i.overdue ? <Badge status="overdue">Overdue</Badge> : <Badge status={i.status} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
