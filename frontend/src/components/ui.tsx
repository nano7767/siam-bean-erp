import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { ApiError } from '../api'
import { useAuth } from '../auth'
import { ROLE_LABEL } from '../format'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
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
  return <span className={`badge badge-${STATUS_TONE[status] ?? 'neutral'}`}>{children ?? status}</span>
}

export function LowStockBadge() {
  return <Badge status="low">Low stock</Badge>
}

export function Loading() {
  return <p className="muted loading">Loading…</p>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function ErrorBox({ error }: { error: string | null | undefined }) {
  if (!error) return null
  return (
    <div className="error-box" role="alert">
      {error}
    </div>
  )
}

export function AccessDenied({ message }: { message?: string }) {
  const { user } = useAuth()
  return (
    <div className="access-denied">
      <div className="access-denied-code">403</div>
      <h1>Access denied</h1>
      <p>
        Your role {user && <strong>({ROLE_LABEL[user.role]})</strong>} is not allowed to open this screen.
      </p>
      {message && <p className="muted small">Server said: “{message}”</p>}
      <Link to="/" className="button">
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
      <Empty>
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
            ×
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
  if (total <= pageSize) return <p className="muted small">{total} shown</p>
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="pagination">
      <span className="muted small">
        {from}–{to} of {total}
      </span>
      <button type="button" className="button secondary small" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Previous
      </button>
      <span className="small">
        Page {page} of {pages}
      </span>
      <button type="button" className="button secondary small" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next →
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
