import { useState, type ReactNode } from 'react'
import { qty, thb } from '../format'
import { Icon } from './icons'

/** Round the axis up to a clean number and return evenly spaced ticks (0, 5K, 10K…). */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 250, 500, 750, 1000].slice(0, count + 1)
  const rough = max / count
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? 10 * power
  return Array.from({ length: count + 1 }, (_, i) => i * step)
}

function compact(value: number): string {
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${+(value / 1_000).toFixed(1)}K`
  return String(value)
}

function ChartCard({
  title,
  subtitle,
  legend,
  chart,
  table,
}: {
  title: string
  subtitle: ReactNode
  legend?: ReactNode
  chart: ReactNode
  table: ReactNode
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  return (
    <section className="card chart-card">
      <header className="chart-head">
        <div>
          <h2>{title}</h2>
          <p className="muted small">{subtitle}</p>
        </div>
        <div className="segmented" role="group" aria-label={`${title} view`}>
          {(['chart', 'table'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
              {v === 'chart' ? 'Chart' : 'Table'}
            </button>
          ))}
        </div>
      </header>
      {view === 'chart' ? (
        <>
          {legend}
          {chart}
        </>
      ) : (
        <div className="table-wrap chart-table">{table}</div>
      )}
    </section>
  )
}

export interface DayTotal {
  date: string // yyyy-mm-dd
  label: string // "Mon 19"
  total: number
}

/** Invoiced sales per day, last 7 days. One series, so the title names it and there is no legend. */
export function SalesChart({ days }: { days: DayTotal[] }) {
  const max = Math.max(...days.map((d) => d.total), 0)
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const week = days.reduce((sum, d) => sum + d.total, 0)
  const peak = days.reduce((best, d) => (d.total > best.total ? d : best), days[0])
  const today = days[days.length - 1]

  return (
    <ChartCard
      title="Sales, last 7 days"
      subtitle={
        <>
          Invoiced incl. VAT · <strong className="ink">{thb(week)}</strong> this week
        </>
      }
      chart={
        <div className="vchart">
          <div className="vchart-plot">
            {ticks.map((t) => (
              <div key={t} className="gridline" style={{ bottom: `${(t / top) * 100}%` }}>
                <span>{compact(t)}</span>
              </div>
            ))}
            <div className="vchart-columns">
              {days.map((d) => {
                const showLabel = d.total > 0 && (d === today || d === peak)
                return (
                  <button key={d.date} type="button" className="vchart-col" aria-label={`${d.label}: ${thb(d.total)}`}>
                    <span className="vchart-bar" style={{ height: `${(d.total / top) * 100}%` }}>
                      {showLabel && <span className="bar-label">{compact(d.total)}</span>}
                    </span>
                    <span className="tip" role="tooltip">
                      <strong>{thb(d.total)}</strong>
                      <span>{d.label}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="vchart-x">
            {days.map((d) => (
              <span key={d.date} className={d === today ? 'today' : ''}>
                {d === today ? 'Today' : d.label}
              </span>
            ))}
          </div>
          {week === 0 && <p className="chart-note muted small">No invoices in the last 7 days yet. Confirm an order to see it here.</p>}
        </div>
      }
      table={
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th className="num">Sales incl. VAT</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <td>{d.label}</td>
                <td className="num">{thb(d.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  )
}

export interface StockRow {
  id: number
  sku: string
  name: string
  unit: string
  on_hand: number
  reorder_level: number
  low_stock: boolean
}

/** On hand per product as horizontal bars, with each product's reorder level marked. */
export function StockChart({ products }: { products: StockRow[] }) {
  const top = Math.max(...products.map((p) => Math.max(p.on_hand, p.reorder_level)), 1) * 1.08
  // Most at-risk first: lowest on hand relative to reorder level.
  const rows = [...products].sort(
    (a, b) => a.on_hand / Math.max(a.reorder_level, 1) - b.on_hand / Math.max(b.reorder_level, 1),
  )
  const lowCount = rows.filter((p) => p.low_stock).length

  return (
    <ChartCard
      title="Stock health"
      subtitle={
        lowCount > 0 ? (
          <>
            <strong className="text-bad">{lowCount} below reorder level</strong> · most at risk first
          </>
        ) : (
          'Every product is above its reorder level'
        )
      }
      legend={
        <ul className="legend">
          <li>
            <span className="key key-ok" /> On hand
          </li>
          <li>
            <span className="key key-low" /> Below reorder level
          </li>
          <li>
            <span className="key key-marker" /> Reorder level
          </li>
        </ul>
      }
      chart={
        <div className="hchart">
          {rows.map((p) => (
            <button
              key={p.id}
              type="button"
              className="hchart-row"
              aria-label={`${p.sku}: ${qty(p.on_hand)} ${p.unit} on hand, reorder at ${qty(p.reorder_level)}${p.low_stock ? ', low stock' : ''}`}
            >
              <span className="hchart-label">
                <strong>{p.sku}</strong>
                <span>{p.name}</span>
              </span>
              <span className="hchart-track">
                <span className={`hchart-bar ${p.low_stock ? 'low' : ''}`} style={{ width: `${(p.on_hand / top) * 100}%` }} />
                <span className="hchart-marker" style={{ left: `${(p.reorder_level / top) * 100}%` }} />
                {/* Label starts after the bar or the reorder marker, whichever is further right, so they never collide. */}
                <span className="hchart-value" style={{ left: `${(Math.max(p.on_hand, p.reorder_level) / top) * 100}%` }}>
                  {qty(p.on_hand)}
                  {p.low_stock && (
                    <span className="low-flag">
                      <Icon name="alert" size={12} strokeWidth={2.5} />
                      Low
                    </span>
                  )}
                </span>
              </span>
              <span className="tip" role="tooltip">
                <strong>
                  {qty(p.on_hand)} {p.unit} on hand
                </strong>
                <span>
                  {p.sku} · reorder at {qty(p.reorder_level)}
                </span>
              </span>
            </button>
          ))}
        </div>
      }
      table={
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th className="num">On hand</th>
              <th className="num">Reorder at</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.sku}</td>
                <td className="num">
                  {qty(p.on_hand)} {p.unit}
                </td>
                <td className="num">{qty(p.reorder_level)}</td>
                <td>{p.low_stock ? 'Low stock' : 'OK'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  )
}
