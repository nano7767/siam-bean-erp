import { Link } from 'react-router'
import { useAuth } from '../auth'
import { LoadError, Loading, LowStockBadge, PageHeader } from '../components/ui'
import { day, qty, thb } from '../format'
import type { Dashboard as DashboardData } from '../types'
import { useApi } from '../useApi'

export function Dashboard() {
  const { user, can } = useAuth()
  const { data, error, loading, reload } = useApi<DashboardData>('/dashboard')

  return (
    <>
      <PageHeader
        title={`Good day, ${user?.name}`}
        subtitle={data ? `Live numbers for ${day(data.date)}` : 'Live numbers from the same tables as every other screen'}
        actions={
          <button type="button" className="button secondary" onClick={reload} disabled={loading}>
            ↻ Refresh
          </button>
        }
      />
      <LoadError error={error} />
      {!data && loading && <Loading />}
      {data && (
        <>
          <section className="tiles">
            <div className="tile">
              <span className="tile-label">Sales today</span>
              <span className="tile-value">{thb(data.sales_today)}</span>
              <span className="tile-note">Invoices issued today, incl. VAT</span>
            </div>
            <Link to={can('admin', 'sales', 'accountant') ? '/invoices?status=open' : '/'} className="tile">
              <span className="tile-label">Open invoices</span>
              <span className="tile-value">{thb(data.open_invoices_amount)}</span>
              <span className="tile-note">
                {data.open_invoices_count} unpaid
                {data.overdue_invoices_count > 0 && <> · <span className="text-bad">{data.overdue_invoices_count} overdue</span></>}
              </span>
            </Link>
            <Link to="/products?low=1" className={`tile ${data.low_stock_count > 0 ? 'tile-alert' : ''}`}>
              <span className="tile-label">Low-stock products</span>
              <span className="tile-value">{data.low_stock_count}</span>
              <span className="tile-note">Below their reorder level</span>
            </Link>
            <div className="tile">
              <span className="tile-label">Stock value</span>
              <span className="tile-value">{thb(data.stock_value)}</span>
              <span className="tile-note">On hand × cost</span>
            </div>
          </section>

          <section className="grid-2">
            <div className="card">
              <h2>Low stock</h2>
              {data.low_stock_products.length === 0 ? (
                <p className="muted">Every product is above its reorder level.</p>
              ) : (
                <ul className="plain-list">
                  {data.low_stock_products.map((p) => (
                    <li key={p.id}>
                      <div>
                        <strong>{p.sku}</strong> <span className="muted">{p.name}</span>
                      </div>
                      <div className="row-end">
                        <span>
                          {qty(p.on_hand)} / {qty(p.reorder_level)} {p.unit}
                        </span>
                        <LowStockBadge />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {can('admin', 'warehouse') && data.low_stock_count > 0 && (
                <Link to="/stock" className="button secondary small">
                  Record stock-in
                </Link>
              )}
            </div>
            <div className="card">
              <h2>Quick actions</h2>
              <div className="quick-actions">
                {can('admin', 'sales') && (
                  <Link to="/orders/new" className="button">
                    + New sales order
                  </Link>
                )}
                {can('admin', 'sales') && data.draft_orders_count > 0 && (
                  <Link to="/orders?status=draft" className="button secondary">
                    {data.draft_orders_count} draft order{data.draft_orders_count > 1 ? 's' : ''} to confirm
                  </Link>
                )}
                {can('admin', 'warehouse') && (
                  <Link to="/stock" className="button">
                    Record stock-in
                  </Link>
                )}
                {can('admin', 'accountant') && (
                  <Link to="/accounting" className="button">
                    Record a payment
                  </Link>
                )}
                <Link to="/products" className="button secondary">
                  View products and stock
                </Link>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  )
}
