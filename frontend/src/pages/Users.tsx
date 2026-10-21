import { useState, type FormEvent } from 'react'
import { patch, post, type Role, type User } from '../api'
import { useAuth } from '../auth'
import { Icon } from '../components/icons'
import { notify } from '../components/toast'
import { Avatar, Badge, ErrorBox, Field, LoadError, Loading, Modal, PageHeader } from '../components/ui'
import { ROLE_LABEL } from '../format'
import { useApi } from '../useApi'

const ROLES: Role[] = ['admin', 'sales', 'warehouse', 'accountant']

const ROLE_HELP: Record<Role, string> = {
  admin: 'Everything, including users and prices',
  sales: 'Customers, sales orders, view invoices',
  warehouse: 'Stock in, adjustments, view products',
  accountant: 'Invoices and payments, view products and customers',
}

export function Users() {
  const { user: me } = useAuth()
  const { data, error, reload } = useApi<User[]>('/users')
  const [adding, setAdding] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (error) return <LoadError error={error} />
  if (!data) return <Loading />

  async function change(user: User, body: Partial<Pick<User, 'role' | 'active'>>) {
    setActionError(null)
    try {
      await patch(`/users/${user.id}`, body)
      notify(`${user.name} updated`)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <PageHeader
        icon="users"
        title="Users"
        subtitle="Each person has one role. The server checks it on every request."
        actions={
          <button type="button" className="button" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} />
            Add user
          </button>
        }
      />
      <ErrorBox error={actionError} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id} className={u.active ? '' : 'row-inactive'}>
                <td>
                  <div className="name-cell">
                    <Avatar name={u.name} size="sm" />
                    <span>
                      <strong>{u.name}</strong> {u.id === me?.id && <span className="muted small">(you)</span>}
                    </span>
                  </div>
                </td>
                <td>{u.email}</td>
                <td>
                  <select value={u.role} disabled={u.id === me?.id} onChange={(e) => change(u, { role: e.target.value as Role })}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{u.active ? <Badge status="paid">Active</Badge> : <Badge status="inactive">Deactivated</Badge>}</td>
                <td className="actions">
                  {u.id !== me?.id && (
                    <button type="button" className="button ghost small" onClick={() => change(u, { active: !u.active })}>
                      {u.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>What each role can do</h2>
        <ul className="plain-list">
          {ROLES.map((r) => (
            <li key={r}>
              <strong>{ROLE_LABEL[r]}</strong>
              <span className="muted">{ROLE_HELP[r]}</span>
            </li>
          ))}
        </ul>
      </div>
      {adding && (
        <AddUser
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            reload()
          }}
        />
      )}
    </>
  )
}

function AddUser({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'sales' as Role })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await post('/users', form)
      notify(`${form.name} can now log in as ${ROLE_LABEL[form.role]}`)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Add user" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <ErrorBox error={error} />
        <Field label="Name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ploy" />
        </Field>
        <Field label="Email">
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Temporary password" hint="At least 8 characters. Share it with the person privately.">
          <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Role" hint={ROLE_HELP[form.role]}>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button" disabled={busy}>
            {busy ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
