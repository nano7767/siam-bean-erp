import { useState, type FormEvent } from 'react'
import { patch, post, query } from '../api'
import { useAuth } from '../auth'
import { Icon } from '../components/icons'
import { notify } from '../components/toast'
import { Avatar, Badge, Empty, ErrorBox, Field, LoadError, Loading, Modal, PageHeader, Pagination, SearchInput } from '../components/ui'
import { terms } from '../format'
import type { Customer, Page } from '../types'
import { useApi, useDebounced } from '../useApi'

export function Customers() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<Customer | 'new' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const q = useDebounced(search)
  const { data, error, loading, reload } = useApi<Page<Customer>>(
    `/customers${query({ q, page, include_inactive: showInactive || undefined })}`,
  )
  const canEdit = can('admin', 'sales')

  async function toggleActive(customer: Customer) {
    setActionError(null)
    try {
      await patch(`/customers/${customer.id}`, { active: !customer.active })
      notify(`${customer.name} ${customer.active ? 'deactivated' : 'reactivated'}`)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    }
  }

  if (error?.status === 403) return <LoadError error={error} />

  return (
    <>
      <PageHeader
        icon="store"
        title="Customers"
        subtitle="Cafés that buy from Siam Bean. Tax ID is required for Thai tax invoices."
        actions={
          canEdit && (
            <button type="button" className="button" onClick={() => setEditing('new')}>
              <Icon name="plus" size={16} />
              New customer
            </button>
          )
        }
      />
      <div className="toolbar">
        <SearchInput
          placeholder="Search name or tax ID…"
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
        />
        <label className="check">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show deactivated
        </label>
      </div>
      <LoadError error={error} />
      <ErrorBox error={actionError} />
      {!data && loading && <Loading />}
      {data && data.items.length === 0 && (
        <Empty>{q ? `No customer matches “${q}”.` : 'No customers yet. Add the first one with “New customer”.'}</Empty>
      )}
      {data && data.items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Tax ID</th>
                <th>Payment terms</th>
                <th>Contact</th>
                <th>Status</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id} className={c.active ? '' : 'row-inactive'}>
                  <td>
                    <div className="name-cell">
                      <Avatar name={c.name} size="sm" />
                      <div>
                        <strong>{c.name}</strong>
                        {c.address && <div className="muted small">{c.address}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="mono">{c.tax_id}</td>
                  <td>{terms(c.payment_terms_days)}</td>
                  <td>{c.contact}</td>
                  <td>{c.active ? <Badge status="paid">Active</Badge> : <Badge status="inactive">Deactivated</Badge>}</td>
                  {canEdit && (
                    <td className="actions">
                      <button type="button" className="button secondary small" onClick={() => setEditing(c)}>
                        Edit
                      </button>
                      <button type="button" className="button ghost small" onClick={() => toggleActive(c)}>
                        {c.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={page} pageSize={data.page_size} total={data.total} onPage={setPage} />}
      {editing && (
        <CustomerForm
          customer={editing === 'new' ? null : editing}
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

function CustomerForm({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    tax_id: customer?.tax_id ?? '',
    address: customer?.address ?? '',
    contact: customer?.contact ?? '',
    payment_terms_days: String(customer?.payment_terms_days ?? 30),
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value })

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const body = { ...form, payment_terms_days: Number(form.payment_terms_days || 0) }
    try {
      if (customer) await patch(`/customers/${customer.id}`, body)
      else await post('/customers', body)
      notify(`${form.name} saved`)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={customer ? `Edit ${customer.name}` : 'New customer'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <ErrorBox error={error} />
        <Field label="Name">
          <input value={form.name} onChange={set('name')} placeholder="Café Lune" />
        </Field>
        <div className="form-row">
          <Field label="Tax ID (13 digits)">
            <input value={form.tax_id} onChange={set('tax_id')} inputMode="numeric" placeholder="0105561000011" />
          </Field>
          <Field label="Payment terms">
            <select value={form.payment_terms_days} onChange={set('payment_terms_days')}>
              {['0', '7', '15', '30', '45', '60'].map((d) => (
                <option key={d} value={d}>
                  {terms(Number(d))}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Address">
          <input value={form.address} onChange={set('address')} />
        </Field>
        <Field label="Contact person / phone">
          <input value={form.contact} onChange={set('contact')} />
        </Field>
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button" disabled={busy}>
            {busy ? 'Saving…' : 'Save customer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
