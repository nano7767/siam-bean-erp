import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import type { Role } from '../api'
import { useAuth } from '../auth'
import { Icon, type IconName } from '../components/icons'
import { ErrorBox, Field } from '../components/ui'

const DEMO_PASSWORD = 'SiamBean2026!'
const DEMO_ACCOUNTS: { email: string; role: Role; label: string; who: string; icon: IconName }[] = [
  { email: 'admin@siambean.example.com', role: 'admin', label: 'Admin', who: 'Khun Somchai', icon: 'shield' },
  { email: 'sales@siambean.example.com', role: 'sales', label: 'Sales', who: 'Nok', icon: 'orders' },
  { email: 'warehouse@siambean.example.com', role: 'warehouse', label: 'Warehouse', who: 'Lek', icon: 'box' },
  { email: 'accountant@siambean.example.com', role: 'accountant', label: 'Accountant', who: 'Fon', icon: 'wallet' },
]

const PROMISES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'box', title: 'Stock that is never wrong', text: 'Every bag in or out is a movement. Nobody types the number.' },
  { icon: 'invoice', title: 'Invoices in one click', text: 'Confirming an order takes the stock and issues INV-000x with 7% VAT.' },
  { icon: 'wallet', title: 'Know who owes you', text: 'Open invoices and payments, live on the dashboard.' },
  { icon: 'lock', title: 'Everyone in their lane', text: 'Four roles, checked by the server on every request.' },
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
      <section className="login-hero" aria-label="About Siam Bean ERP">
        <div className="login-hero-brand">
          <img src="/favicon.svg" alt="" width={44} height={44} />
          <div>
            <strong>Siam Bean Co.</strong>
            <span>Coffee roasters · Bangkok</span>
          </div>
        </div>
        <div className="login-hero-copy">
          <h1>
            Sales, stock and invoices{' '}
            <br />
            in one place.
          </h1>
          <p>One system for the whole team, from the café's order to the money in the bank.</p>
        </div>
        <ul className="login-promises">
          {PROMISES.map((item) => (
            <li key={item.title}>
              <span className="promise-icon">
                <Icon name={item.icon} size={18} />
              </span>
              <div>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="login-beans" aria-hidden />
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div>
            <h2>Welcome back</h2>
            <p className="muted">Log in to the Siam Bean Mini ERP</p>
          </div>
          <ErrorBox error={error} />
          <Field label="Email">
            <input
              type="email"
              autoComplete="username"
              value={email}
              placeholder="you@siambean.example.com"
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button type="submit" className="button wide large" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
            {!busy && <Icon name="arrowRight" size={18} />}
          </button>

          <div className="demo-accounts">
            <p className="demo-title">
              <span>Demo accounts</span>
              <span className="muted small">password {DEMO_PASSWORD}</span>
            </p>
            <div className="demo-grid">
              {DEMO_ACCOUNTS.map((account) => {
                const selected = email === account.email
                return (
                  <button
                    key={account.email}
                    type="button"
                    className={`demo-account demo-${account.role} ${selected ? 'selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => {
                      setEmail(account.email)
                      setPassword(DEMO_PASSWORD)
                      setError(null)
                    }}
                  >
                    <span className="demo-icon">
                      <Icon name={account.icon} size={16} />
                    </span>
                    <span className="demo-text">
                      <strong>{account.label}</strong>
                      <span>{account.who}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}
