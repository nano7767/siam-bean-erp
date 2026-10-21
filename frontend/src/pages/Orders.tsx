import { Link, useSearchParams } from 'react-router'
import { query } from '../api'
import { useAuth } from '../auth'
import { Icon } from '../components/icons'
import { Badge, Empty, LoadError, Loading, PageHeader } from '../components/ui'
import { day, thb } from '../format'
import type { OrderRow } from '../types'
import { useApi } from '../useApi'

const FILTERS = [
  ['', 'All'],
  ['draft', 'Draft'],
  ['confirmed', 'Confirmed'],
  ['paid', 'Paid'],
  ['cancelled', 'Cancelled'],
] as const

export function Orders() {
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const { data, error, loading } = useApi<OrderRow[]>(`/orders${query({ status })}`)

  if (error?.status === 403) return <LoadError error={error} />

  return (
    <>
      <PageHeader
        icon="orders"
        title="Sales orders"
        subtitle="Draft → Confirm: stock goes down and the invoice is issued in one step."
        actions={
          can('admin', 'sales') && (
            <Link to="/orders/new" className="button">
              <Icon name="plus" size={16} />
              New sales order
            </Link>
          )
        }
      />
      <div className="tabs">
        {FILTERS.map(([value, label]) => (
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
        <Empty>
          {status ? `No ${status} orders.` : 'No sales orders yet.'}{' '}
          {can('admin', 'sales') && <Link to="/orders/new">Create the first one</Link>}
        </Empty>
      )}
      {data && data.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th className="num">Total incl. VAT</th>
                <th>Status</th>
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link to={`/orders/${o.id}`} className="mono strong">
                      {o.number}
                    </Link>
                  </td>
                  <td>{day(o.order_date)}</td>
                  <td>{o.customer_name}</td>
                  <td className="num">{thb(o.total)}</td>
                  <td>
                    <Badge status={o.status} />
                  </td>
                  <td>
                    {o.invoice_id ? (
                      <Link to={`/invoices/${o.invoice_id}`} className="mono">
                        {o.invoice_number}
                      </Link>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
