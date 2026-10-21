import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { post, query } from '../api'
import { notify } from '../components/toast'
import { Empty, ErrorBox, Field, LoadError, Loading, LowStockBadge, PageHeader } from '../components/ui'
import { dateTime, qty } from '../format'
import type { Movement, Page, Product } from '../types'
import { useApi } from '../useApi'

export function Stock() {
  const products = useApi<Page<Product>>(`/products${query({ page_size: 100 })}`)
  const movements = useApi<Movement[]>('/stock/movements')

  if (products.error) return <LoadError error={products.error} />
  if (movements.error) return <LoadError error={movements.error} />

  const refresh = () => {
    products.reload()
    movements.reload()
  }

  return (
    <>
      <PageHeader icon="box" title="Stock" subtitle="Record goods received and stock-count corrections. Sales take stock out automatically." />
      <section className="grid-2">
        <MovementForm kind="in" products={products.data?.items ?? []} onSaved={refresh} />
        <MovementForm kind="adjust" products={products.data?.items ?? []} onSaved={refresh} />
      </section>

      <h2>Latest movements</h2>
      {!movements.data && movements.loading && <Loading />}
      {movements.data && movements.data.length === 0 && <Empty>No stock movements yet.</Empty>}
      {movements.data && movements.data.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Document</th>
                <th>Product</th>
                <th className="num">In / out</th>
                <th>Note</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {movements.data.map((m) => (
                <tr key={m.id}>
                  <td>{dateTime(m.created_at)}</td>
                  <td className="mono">{m.ref_doc}</td>
                  <td>
                    <Link to={`/products/${m.product_id}`}>{m.sku}</Link>
                  </td>
                  <td className={`num strong ${m.quantity < 0 ? 'text-bad' : 'text-good'}`}>
                    {m.quantity > 0 ? '+' : '−'}
                    {qty(Math.abs(m.quantity))} {m.unit}
                  </td>
                  <td>{m.note}</td>
                  <td>{m.created_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function MovementForm({ kind, products, onSaved }: { kind: 'in' | 'adjust'; products: Product[]; onSaved: () => void }) {
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [direction, setDirection] = useState<'-' | '+'>('-')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const product = products.find((p) => String(p.id) === productId)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!productId) return setError('Choose a product')
    const amount = Number(quantity)
    if (!Number.isInteger(amount) || amount <= 0) return setError('Quantity must be a whole number greater than zero')
    setBusy(true)
    setError(null)
    try {
      const signed = kind === 'adjust' && direction === '-' ? -amount : amount
      const result = await post<Movement & { on_hand: number }>('/stock/movements', {
        product_id: Number(productId),
        kind,
        quantity: signed,
        note,
      })
      notify(`${result.ref_doc}: ${result.sku} ${signed > 0 ? '+' : '−'}${amount}, now ${result.on_hand} on hand`)
      setQuantity('')
      setNote('')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h2>{kind === 'in' ? 'Stock-in (goods received)' : 'Adjustment (count, damage, loss)'}</h2>
      <ErrorBox error={error} />
      <Field
        label="Product"
        hint={
          product && (
            <>
              On hand now: <strong>{qty(product.on_hand)} {product.unit}</strong> {product.low_stock && <LowStockBadge />}
            </>
          )
        }
      >
        <select value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Choose a product…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} · {p.name} ({qty(p.on_hand)} {p.unit})
            </option>
          ))}
        </select>
      </Field>
      <div className="form-row">
        {kind === 'adjust' && (
          <Field label="Direction">
            <select value={direction} onChange={(e) => setDirection(e.target.value as '-' | '+')}>
              <option value="-">Remove (−)</option>
              <option value="+">Add (+)</option>
            </select>
          </Field>
        )}
        <Field label={`Quantity${product ? ` (${product.unit})` : ''}`}>
          <input type="number" min="1" step="1" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
      </div>
      <Field label={kind === 'in' ? 'Note (supplier, delivery no.)' : 'Reason (required)'}>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={kind === 'in' ? 'Doi Chang Farm delivery' : 'Damaged bags'}
        />
      </Field>
      <button type="submit" className="button" disabled={busy}>
        {busy ? 'Saving…' : kind === 'in' ? 'Add stock' : 'Save adjustment'}
      </button>
    </form>
  )
}
