import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { post, put, query } from '../api'
import { notify } from '../components/toast'
import { ErrorBox, Field, LoadError, Loading, LowStockBadge, PageHeader } from '../components/ui'
import { qty, terms, thb } from '../format'
import type { Customer, Order, Page, Product } from '../types'
import { useApi, useDebounced } from '../useApi'

interface LineDraft {
  key: number
  productId: string
  quantity: string
}

let nextKey = 1
const emptyLine = (): LineDraft => ({ key: nextKey++, productId: '', quantity: '' })

/** Create a new draft order (/orders/new) or edit a draft (/orders/:id/edit). */
export function OrderForm() {
  const { id } = useParams()
  const existing = useApi<Order>(id ? `/orders/${id}` : null)
  const products = useApi<Page<Product>>(`/products${query({ page_size: 100 })}`)

  if (existing.error) return <LoadError error={existing.error} />
  if (products.error) return <LoadError error={products.error} />
  if (id && !existing.data) return <Loading />
  if (existing.data && existing.data.status !== 'draft')
    return <ErrorBox error={`${existing.data.number} is ${existing.data.status} and can no longer be edited.`} />
  return <OrderEditor order={existing.data} products={products.data?.items ?? null} />
}

function OrderEditor({ order, products }: { order: Order | null; products: Product[] | null }) {
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<PickedCustomer | null>(order?.customer ?? null)
  const [lines, setLines] = useState<LineDraft[]>(() =>
    order ? order.lines.map((l) => ({ key: nextKey++, productId: String(l.product_id), quantity: String(l.quantity) })) : [emptyLine()],
  )
  const [note, setNote] = useState(order?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const id = order?.id

  const productList = products ?? []
  const byId = new Map(productList.map((p) => [String(p.id), p]))
  const priced = lines.map((line) => {
    const product = byId.get(line.productId)
    const quantity = Number(line.quantity) || 0
    return { line, product, quantity, total: product ? Number(product.price) * quantity : 0 }
  })
  const subtotal = priced.reduce((sum, row) => sum + row.total, 0)
  const vat = Math.round(subtotal * 0.07 * 100) / 100
  // Total ordered per product, to warn before confirming would fail.
  const wanted = new Map<string, number>()
  priced.forEach(({ line, quantity }) => wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + quantity))

  const update = (key: number, patch: Partial<LineDraft>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!customer) return setError('Choose a customer')
    const filled = lines.filter((l) => l.productId)
    if (filled.length === 0) return setError('Add at least one product to the order')
    const bad = filled.find((l) => !Number.isInteger(Number(l.quantity)) || Number(l.quantity) <= 0)
    if (bad) return setError(`Quantity must be greater than zero (${byId.get(bad.productId)?.sku})`)
    setBusy(true)
    setError(null)
    const body = {
      customer_id: customer.id,
      note,
      lines: filled.map((l) => ({ product_id: Number(l.productId), quantity: Number(l.quantity) })),
    }
    try {
      const order = id ? await put<Order>(`/orders/${id}`, body) : await post<Order>('/orders', body)
      notify(`${order.number} saved as draft`)
      navigate(`/orders/${order.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title={order ? `Edit ${order.number}` : 'New sales order'}
        subtitle="Saved as a draft first. Stock only moves when you confirm."
      />
      <form className="form order-form" onSubmit={submit}>
        <ErrorBox error={error} />
        <div className="card">
          <CustomerPicker value={customer} onChange={setCustomer} />
        </div>

        <div className="card">
          <h2>Products</h2>
          {!products && <Loading />}
          <div className="order-lines">
            {priced.map(({ line, product, total }) => {
              const short = product && (wanted.get(line.productId) ?? 0) > product.on_hand
              return (
                <div key={line.key} className="order-line">
                  <Field label="Product">
                    <select value={line.productId} onChange={(e) => update(line.key, { productId: e.target.value })}>
                      <option value="">Choose a product…</option>
                      {productList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} · {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={`Quantity${product ? ` (${product.unit})` : ''}`}>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={(e) => update(line.key, { quantity: e.target.value })}
                    />
                  </Field>
                  <div className="line-figures">
                    <span className="muted small">Unit price</span>
                    <span>{product ? thb(product.price) : '—'}</span>
                  </div>
                  <div className="line-figures">
                    <span className="muted small">Line total</span>
                    <strong>{thb(total)}</strong>
                  </div>
                  <button
                    type="button"
                    className="icon-button remove-line"
                    aria-label="Remove line"
                    onClick={() => setLines((current) => (current.length > 1 ? current.filter((l) => l.key !== line.key) : [emptyLine()]))}
                  >
                    ×
                  </button>
                  {product && (
                    <div className={`line-stock ${short ? 'text-bad' : 'muted'}`}>
                      {qty(product.on_hand)} {product.unit} on hand {product.low_stock && <LowStockBadge />}
                      {short && ' · not enough stock: confirming this order will fail'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <button type="button" className="button secondary small" onClick={() => setLines((current) => [...current, emptyLine()])}>
            + Add product
          </button>
        </div>

        <div className="card totals-card">
          <Field label="Note (optional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Deliver Friday morning" />
          </Field>
          <dl className="totals">
            <dt>Subtotal</dt>
            <dd>{thb(subtotal)}</dd>
            <dt>VAT 7%</dt>
            <dd>{thb(vat)}</dd>
            <dt className="grand">Total</dt>
            <dd className="grand">{thb(subtotal + vat)}</dd>
          </dl>
        </div>

        <div className="form-actions">
          <Link to={id ? `/orders/${id}` : '/orders'} className="button secondary">
            Cancel
          </Link>
          <button type="submit" className="button" disabled={busy}>
            {busy ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      </form>
    </>
  )
}

type PickedCustomer = Pick<Customer, 'id' | 'name' | 'payment_terms_days'>

function CustomerPicker({ value, onChange }: { value: PickedCustomer | null; onChange: (c: PickedCustomer | null) => void }) {
  const [search, setSearch] = useState('')
  const q = useDebounced(search, 200)
  const results = useApi<Page<Customer>>(value ? null : `/customers${query({ q })}`)

  if (value)
    return (
      <div className="picked">
        <div>
          <span className="muted small">Customer</span>
          <strong>{value.name}</strong>
          <span className="muted small">Payment terms: {terms(value.payment_terms_days)}</span>
        </div>
        <button type="button" className="button secondary small" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    )

  return (
    <div className="picker">
      <Field label="Customer">
        <input type="search" placeholder="Type part of the café name…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Field>
      <LoadError error={results.error} />
      <ul className="picker-results">
        {results.data?.items.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onChange(c)}>
              <strong>{c.name}</strong>
              <span className="muted small">
                {c.tax_id} · {terms(c.payment_terms_days)}
              </span>
            </button>
          </li>
        ))}
        {results.data && results.data.items.length === 0 && <li className="muted small">No customer matches “{q}”.</li>}
        {results.data && results.data.total > results.data.items.length && (
          <li className="muted small">Showing 20 of {results.data.total}: type more to narrow down.</li>
        )}
      </ul>
    </div>
  )
}
