import { Link, useParams } from 'react-router'
import { query } from '../api'
import { Empty, LoadError, Loading, LowStockBadge, PageHeader } from '../components/ui'
import { dateTime, qty } from '../format'
import type { Page, Product, StockCardRow } from '../types'
import { useApi } from '../useApi'

export function StockCard() {
  const { id } = useParams()
  const card = useApi<StockCardRow[]>(`/products/${id}/movements`)
  // The product row (for name and on hand) comes from the list endpoint.
  const products = useApi<Page<Product>>(`/products${query({ include_inactive: true, page_size: 100 })}`)
  const product = products.data?.items.find((p) => String(p.id) === id)

  return (
    <>
      <PageHeader
        title={product ? `Stock card · ${product.sku}` : 'Stock card'}
        subtitle={
          product && (
            <>
              {product.name} · on hand <strong>{qty(product.on_hand)} {product.unit}</strong> · reorder at {qty(product.reorder_level)}{' '}
              {product.low_stock && <LowStockBadge />}
            </>
          )
        }
        actions={
          <Link to="/stock" className="button secondary">
            Record stock-in
          </Link>
        }
      />
      <LoadError error={card.error} />
      {!card.data && card.loading && <Loading />}
      {card.data && card.data.length === 0 && <Empty>No movements yet.</Empty>}
      {card.data && card.data.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Document</th>
                <th className="num">In / out</th>
                <th className="num">Balance</th>
                <th>Note</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {card.data.map((row) => (
                <tr key={row.id}>
                  <td>{dateTime(row.created_at)}</td>
                  <td className="mono">{row.ref_doc}</td>
                  <td className={`num strong ${row.quantity < 0 ? 'text-bad' : 'text-good'}`}>
                    {row.quantity > 0 ? '+' : '−'}
                    {qty(Math.abs(row.quantity))}
                  </td>
                  <td className="num">{qty(row.balance)}</td>
                  <td>{row.note}</td>
                  <td>{row.created_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">
        <Link to="/products">← All products</Link>
      </p>
    </>
  )
}
