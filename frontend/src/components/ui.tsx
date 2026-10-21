import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { ApiError } from '../api'
import { useAuth } from '../auth'
import { ROLE_LABEL } from '../format'
import { Icon, type IconName } from './icons'

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  icon?: IconName
}) {
  return (
    <header className="page-header">
      <div className="page-title">
        {icon && (
          <span className="page-icon">
            <Icon name={icon} size={22} />
          </span>
        )}
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

const STATUS_TONE: Record<string, string> = {
  draft: 'neutral',
  confirmed: 'info',
  open: 'warn',
  paid: 'good',
  cancelled: 'muted',
  low: 'bad',
  inactive: 'muted',
  overdue: 'bad',
}

export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  return (
    <span className={`badge badge-${STATUS_TONE[status] ?? 'neutral'}`}>
      <span className="badge-dot" aria-hidden />
      {children ?? status}
    </span>
  )
}

export function LowStockBadge() {
  return (
    <span className="badge badge-bad">
      <Icon name="alert" size={12} strokeWidth={2.5} />
      Low stock
    </span>
  )
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name
    .replace(/^Khun\s+/i, '')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  // Same name → same tint, so a person is recognisable across screens.
  const hue = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 6
  return (
    <span className={`avatar avatar-${size} avatar-tint-${hue}`} aria-hidden>
      {initials}
    </span>
  )
}

/** Placeholder rows while the first load is in flight. */
export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-block" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row" style={{ width: `${92 - i * 9}%` }} />
      ))}
    </div>
  )
}

export function Empty({ children, icon = 'inbox' }: { children: ReactNode; icon?: IconName }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <div>{children}</div>
    </div>
  )
}

export function ErrorBox({ error }: { error: string | null | undefined }) {
  if (!error) return null
  return (
    <div className="error-box" role="alert">
      <Icon name="alert" size={18} />
      <span>{error}</span>
    </div>
  )
}

export function AccessDenied({ message }: { message?: string }) {
  const { user } = useAuth()
  return (
    <div className="access-denied">
      <span className="access-denied-icon">
        <Icon name="lock" size={30} />
      </span>
      <div className="access-denied-code">403</div>
      <h1>Access denied</h1>
      <p>
        Your role {user && <strong>({ROLE_LABEL[user.role]})</strong>} is not allowed to open this screen.
      </p>
      {message && <p className="server-said">Server said: “{message}”</p>}
      <Link to="/" className="button">
        <Icon name="arrowLeft" size={16} />
        Back to dashboard
      </Link>
    </div>
  )
}

/** Render the right state for a failed request: 403 → access denied, anything else → error box. */
export function LoadError({ error }: { error: ApiError | null }) {
  if (!error) return null
  if (error.status === 403) return <AccessDenied message={error.message} />
  if (error.status === 404)
    return (
      <Empty icon="search">
        Not found. It may belong to another company or never existed. <Link to="/">Go to dashboard</Link>
      </Empty>
    )
  return <ErrorBox error={error.message} />
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize)
    return (
      <p className="muted small table-count">
        {total} {total === 1 ? 'row' : 'rows'}
      </p>
    )
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="pagination">
      <span className="muted small">
        {from}–{to} of {total}
      </span>
      <button type="button" className="button secondary small" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <Icon name="arrowLeft" size={14} /> Previous
      </button>
      <span className="small">
        Page {page} of {pages}
      </span>
      <button type="button" className="button secondary small" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next <Icon name="arrowRight" size={14} />
      </button>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="search-input">
      <Icon name="search" size={16} />
      <input type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export interface FlowStep {
  label: string
  detail?: ReactNode
  done: boolean
  current?: boolean
}

/**
 * The document trail of one sale: Draft → Confirmed (stock out) → Invoiced → Paid.
 * Shows on the order and the invoice, so every screen tells the same ERP story.
 */
export function DocFlow({ steps, cancelled }: { steps: FlowStep[]; cancelled?: boolean }) {
  return (
    <ol className={`docflow ${cancelled ? 'docflow-cancelled' : ''}`} aria-label="Document flow">
      {steps.map((step, i) => (
        <li key={step.label} className={step.done ? 'done' : step.current ? 'current' : ''}>
          <span className="docflow-marker">{step.done ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}</span>
          <span className="docflow-text">
            <strong>{step.label}</strong>
            {step.detail && <span>{step.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}
