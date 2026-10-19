import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '../auth'
import { ErrorBox, Field } from '../components/ui'

const DEMO_PASSWORD = 'SiamBean2026!'
const DEMO_ACCOUNTS = [
  { email: 'admin@siambean.example.com', label: 'Admin', who: 'Khun Somchai' },
  { email: 'sales@siambean.example.com', label: 'Sales', who: 'Nok' },
  { email: 'warehouse@siambean.example.com', label: 'Warehouse', who: 'Lek' },
  { email: 'accountant@siambean.example.com', label: 'Accountant', who: 'Fon' },
]

export function Login() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <img src="/favicon.svg" alt="" width={44} height={44} />
          <div>
            <h1>Siam Bean Co.</h1>
            <p className="muted">Mini ERP · sales, stock and invoices in one place</p>
          </div>
        </div>
        <ErrorBox error={error} />
        <Field label="Email">
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field label="Password">
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <button type="submit" className="button wide" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>

        <div className="demo-accounts">
          <p className="muted small">Demo accounts (password {DEMO_PASSWORD}). Tap one to fill in:</p>
          <div className="demo-grid">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className="demo-account"
                onClick={() => {
                  setEmail(account.email)
                  setPassword(DEMO_PASSWORD)
                  setError(null)
                }}
              >
                <strong>{account.label}</strong>
                <span>{account.who}</span>
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  )
}
