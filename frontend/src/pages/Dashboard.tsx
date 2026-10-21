import { Link } from 'react-router'
import { query } from '../api'
import { useAuth } from '../auth'
import { SalesChart, StockChart, type DayTotal } from '../components/charts'
import { Icon, type IconName } from '../components/icons'
import { Badge, Empty, LoadError, Loading, PageHeader } from '../components/ui'
import { dateTime, day, qty, thb } from '../format'
import type { Dashboard as DashboardData, InvoiceRow, Movement, OrderRow, Page, Product } from '../types'
import { useApi } from '../useApi'

/** The 7 Bangkok dates ending today, with totals of invoices issued on each. */
function lastSevenDays(today: string, invoices: InvoiceRow[]): DayTotal[] {
  const end = new Date(`${today}T00:00:00Z`)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(end)
    d.setUTCDate(end.getUTCDate() - (6 - i))
    const date = d.toISOString().slice(0, 10)
    const total = invoices
      .filter((inv) => inv.issue_date === date && inv.status !== 'cancelled')
      .reduce((sum, inv) => sum + Number(inv.total), 0)
    const label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
    return { date, label, total }
  })
}

function greeting(): string {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

function Tile({
  icon,
  tone,
  label,
  value,
  note,
  to,
}: {
  icon: IconName
  tone: string
  label: string
  value: string
  note: React.ReactNode
  to?: string
}) {
  const body = (
    <>
      <span className={`tile-icon tone-${tone}`}>
        <Icon name={icon} size={20} />
      </span>
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      <span className="tile-note">{note}</span>
    </>
  )
  return to ? (
    <Link to={to} className={`tile tile-link tile-${tone}`}>
      {body}
    </Link>
  ) : (
    <div className={`tile tile-${tone}`}>{body}</div>
  )
}

export function Dashboard() {
  const { user, can } = useAuth()
  const seesSales = can('admin', 'sales', 'accountant')
  const seesStock = can('admin', 'warehouse')
  const { data, error, loading, reload } = useApi<DashboardData>('/dashboard')
  const products = useApi<Page<Product>>(`/products${query({ page_size: 100 })}`)
  const invoices = useApi<InvoiceRow[]>(seesSales ? '/invoices' : null)
  const orders = useApi<OrderRow[]>(seesSales ? '/orders' : null)
  const movements = useApi<Movement[]>(seesStock && !seesSales ? `/stock/movements${query({ limit: 6 })}` : null)

  function refresh() {
    reload()
    products.reload()
    if (seesSales) {
      invoices.reload()
      orders.reload()
    }
    if (seesStock && !seesSales) movements.reload()
  }

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user?.name.replace(/^Khun\s+/, '')}`}
        subtitle={data ? `Live numbers for ${day(data.date)} · computed from the same tables as every other screen` : 'Live numbers'}
        actions={
          <button type="button" className="button secondary" onClick={refresh} disabled={loading}>
            <Icon name="refresh" size={16} />
            Refresh
          </button>
        }
      />
      <LoadError error={error} />
      {!data && loading && <Loading rows={3} />}
      {data && (
        <div className={loading ? 'refetching' : ''}>
          <section className="tiles">
            <Tile icon="trend" tone="brand" label="Sales today" value={thb(data.sales_today)} note="Invoices issued today, incl. VAT" />
            <Tile
              icon="invoice"
              tone="warn"
              label="Open invoices"
              value={thb(data.open_invoices_amount)}
              to={seesSales ? '/invoices?status=open' : undefined}
              note={
                <>
                  {data.open_invoices_count} unpaid
                  {data.overdue_invoices_count > 0 && <span className="text-bad"> · {data.overdue_invoices_count} overdue</span>}
                </>
              }
            />
            <Tile
              icon="alert"
              tone={data.low_stock_count > 0 ? 'bad' : 'good'}
              label="Low-stock products"
              value={String(data.low_stock_count)}
              to="/products?low=1"
              note={data.low_stock_count > 0 ? 'Below their reorder level' : 'All above reorder level'}
            />
            <Tile icon="box" tone="info" label="Stock value" value={thb(data.stock_value)} note="On hand × cost" />
          </section>

          <section className="dash-grid">
            {seesSales && invoices.data && <SalesChart days={lastSevenDays(data.date, invoices.data)} />}
            {products.data && <StockChart products={products.data.items} />}
          </section>

          <section className="dash-grid">
            {seesSales ? (
              <div className="card">
                <div className="card-head">
                  <h2>Recent sales orders</h2>
                  <Link to="/orders" className="link-arrow">
                    All orders <Icon name="arrowRight" size={14} />
                  </Link>
                </div>
                {!orders.data && <Loading rows={3} />}
                {orders.data && orders.data.length === 0 && <Empty icon="orders">No sales orders yet.</Empty>}
                {orders.data && orders.data.length > 0 && (
                  <ul className="activity">
                    {orders.data.slice(0, 5).map((o) => (
                      <li key={o.id}>
                        <Link to={`/orders/${o.id}`}>
                          <span className="activity-icon">
                            <Icon name="orders" size={16} />
                          </span>
                          <span className="activity-main">
                            <strong>
                              {o.number} · {o.customer_name}
                            </strong>
                            <span className="muted small">
                              {day(o.order_date)}
                              {o.invoice_number && ` · ${o.invoice_number}`}
                            </span>
                          </span>
                          <span className="activity-end">
                            <strong>{thb(o.total)}</strong>
                            <Badge status={o.status} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="card">
                <div className="card-head">
                  <h2>Latest stock movements</h2>
                  <Link to="/stock" className="link-arrow">
                    Stock <Icon name="arrowRight" size={14} />
                  </Link>
                </div>
                {!movements.data && <Loading rows={3} />}
                {movements.data && movements.data.length === 0 && <Empty icon="box">No stock movements yet.</Empty>}
                {movements.data && movements.data.length > 0 && (
                  <ul className="activity">
                    {movements.data.map((m) => (
                      <li key={m.id}>
                        <Link to={`/products/${m.product_id}`}>
                          <span className={`activity-icon ${m.quantity < 0 ? 'out' : 'in'}`}>
                            <Icon name={m.quantity < 0 ? 'truck' : 'box'} size={16} />
                          </span>
                          <span className="activity-main">
                            <strong>
                              {m.ref_doc} · {m.sku}
                            </strong>
                            <span className="muted small">
                              {dateTime(m.created_at)}
                              {m.created_by_name && ` · ${m.created_by_name}`}
                            </span>
                          </span>
                          <span className={`activity-end strong ${m.quantity < 0 ? 'text-bad' : 'text-good'}`}>
                            {m.quantity > 0 ? '+' : '−'}
                            {qty(Math.abs(m.quantity))} {m.unit}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="card">
              <div className="card-head">
                <h2>Quick actions</h2>
              </div>
              <div className="quick-actions">
                {can('admin', 'sales') && (
                  <Link to="/orders/new" className="action">
                    <span className="action-icon tone-brand">
                      <Icon name="plus" />
                    </span>
                    <span>
                      <strong>New sales order</strong>
                      <span>Stock and invoice update on confirm</span>
                    </span>
                  </Link>
                )}
                {can('admin', 'sales') && data.draft_orders_count > 0 && (
                  <Link to="/orders?status=draft" className="action">
                    <span className="action-icon tone-warn">
                      <Icon name="clock" />
                    </span>
                    <span>
                      <strong>
                        {data.draft_orders_count} draft order{data.draft_orders_count > 1 ? 's' : ''}
                      </strong>
                      <span>Waiting to be confirmed</span>
                    </span>
                  </Link>
                )}
                {can('admin', 'warehouse') && (
                  <Link to="/stock" className="action">
                    <span className="action-icon tone-info">
                      <Icon name="box" />
                    </span>
                    <span>
                      <strong>Record stock-in</strong>
                      <span>Goods received or a count correction</span>
                    </span>
                  </Link>
                )}
                {can('admin', 'accountant') && (
                  <Link to="/accounting" className="action">
                    <span className="action-icon tone-good">
                      <Icon name="wallet" />
                    </span>
                    <span>
                      <strong>Record a payment</strong>
                      <span>
                        {data.open_invoices_count > 0 ? `${data.open_invoices_count} invoice(s) still open` : 'Nothing owed right now'}
                      </span>
                    </span>
                  </Link>
                )}
                <Link to="/products" className="action">
                  <span className="action-icon tone-neutral">
                    <Icon name="coffee" />
                  </span>
                  <span>
                    <strong>Products and stock</strong>
                    <span>On hand for every product</span>
                  </span>
                </Link>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
