import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { patch, post, query } from '../api'
import { useAuth } from '../auth'
import { Icon } from '../components/icons'
import { notify } from '../components/toast'
import { Badge, Empty, ErrorBox, Field, LoadError, Loading, LowStockBadge, Modal, PageHeader, Pagination, SearchInput } from '../components/ui'
import { qty, thb } from '../format'
import type { Page, Product } from '../types'
import { useApi, useDebounced } from '../useApi'

export function Products() {
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showInactive, setShowInactive] = useState(false)
  const lowOnly = params.get('low') === '1'
  const q = useDebounced(search)
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const path = `/products${query({ q, page, include_inactive: showInactive || undefined, low_stock_only: lowOnly || undefined })}`
  const { data, error, loading, reload } = useApi<Page<Product>>(path)

  async function toggleActive(product: Product) {
    setActionError(null)
    try {
      await patch(`/products/${product.id}`, { active: !product.active })
      notify(`${product.sku} ${product.active ? 'deactivated' : 'reactivated'}`)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <PageHeader
        icon="coffee"
        title="Products"
        subtitle="On hand is the sum of all stock movements: nobody types it."
        actions={
          can('admin') && (
            <button type="button" className="button" onClick={() => setEditing('new')}>
              <Icon name="plus" size={16} />
              New product
            </button>
          )
        }
      />
      <div className="toolbar">
        <SearchInput
          placeholder="Search SKU or name…"
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => {
              setParams(e.target.checked ? { low: '1' } : {})
              setPage(1)
            }}
          />
          Low stock only
        </label>
        <label className="check">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show deactivated
        </label>
      </div>
      <LoadError error={error} />
      <ErrorBox error={actionError} />
      {!data && loading && <Loading />}
      {data && data.items.length === 0 && (
        <Empty>{q || lowOnly ? 'No products match.' : 'No products yet. Add the first one with “New product”.'}</Empty>
      )}
      {data && data.items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th className="num">Price</th>
                <th className="num">Cost</th>
                <th className="num">On hand</th>
                <th className="num">Reorder at</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className={p.active ? '' : 'row-inactive'}>
                  <td className="mono">{p.sku}</td>
                  <td className="cell-name">{p.name}</td>
                  <td className="num">{thb(p.price)}</td>
                  <td className="num">{thb(p.cost)}</td>
                  <td className="num strong">
                    {qty(p.on_hand)} {p.unit}
                  </td>
                  <td className="num">{qty(p.reorder_level)}</td>
                  <td>
                    {!p.active ? <Badge status="inactive">Deactivated</Badge> : p.low_stock ? <LowStockBadge /> : <Badge status="paid">OK</Badge>}
                  </td>
                  <td className="actions">
                    {can('admin', 'warehouse') && (
                      <Link to={`/products/${p.id}`} className="button secondary small">
                        Stock card
                      </Link>
                    )}
                    {can('admin') && (
                      <>
                        <button type="button" className="button secondary small" onClick={() => setEditing(p)}>
                          Edit
                        </button>
                        <button type="button" className="button ghost small" onClick={() => toggleActive(p)}>
                          {p.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={page} pageSize={data.page_size} total={data.total} onPage={setPage} />}
      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </>
  )
}

function ProductForm({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    unit: product?.unit ?? 'kg',
    price: product?.price ?? '',
    cost: product?.cost ?? '',
    reorder_level: String(product?.reorder_level ?? 0),
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value })

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (form.price === '' || form.cost === '') {
      setError('Price and cost are required')
      return
    }
    setBusy(true)
    setError(null)
    const body = { ...form, reorder_level: Number(form.reorder_level || 0) }
    try {
      if (product) await patch(`/products/${product.id}`, body)
      else await post('/products', body)
      notify(product ? `${form.sku} saved` : `${form.sku.toUpperCase()} created`)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={product ? `Edit ${product.sku}` : 'New product'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <ErrorBox error={error} />
        <div className="form-row">
          <Field label="SKU">
            <input value={form.sku} onChange={set('sku')} placeholder="ARB-1KG" required />
          </Field>
          <Field label="Unit">
            <input value={form.unit} onChange={set('unit')} placeholder="kg" required />
          </Field>
        </div>
        <Field label="Name">
          <input value={form.name} onChange={set('name')} placeholder="Arabica, 1 kg bag" required />
        </Field>
        <div className="form-row">
          <Field label="Sale price (THB, excl. VAT)">
            <input type="number" min="0" step="0.01" inputMode="decimal" value={form.price} onChange={set('price')} />
          </Field>
          <Field label="Cost (THB)">
            <input type="number" min="0" step="0.01" inputMode="decimal" value={form.cost} onChange={set('cost')} />
          </Field>
        </div>
        <Field label="Reorder level" hint="Below this quantity the product shows a low-stock badge.">
          <input type="number" min="0" step="1" inputMode="numeric" value={form.reorder_level} onChange={set('reorder_level')} />
        </Field>
        {product && <p className="muted small">Changing the price never changes existing orders or invoices.</p>}
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button" disabled={busy}>
            {busy ? 'Saving…' : 'Save product'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
