import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import type { Role } from '../api'
import { useAuth } from '../auth'
import { ROLE_LABEL } from '../format'
import { Toaster } from './toast'

const NAV: { to: string; label: string; icon: string; roles: Role[] }[] = [
  { to: '/', label: 'Dashboard', icon: '◧', roles: ['admin', 'sales', 'warehouse', 'accountant'] },
  { to: '/orders', label: 'Sales orders', icon: '✎', roles: ['admin', 'sales', 'accountant'] },
  { to: '/invoices', label: 'Invoices', icon: '▤', roles: ['admin', 'sales', 'accountant'] },
  { to: '/accounting', label: 'Accounting', icon: '฿', roles: ['admin', 'accountant'] },
  { to: '/products', label: 'Products', icon: '☕', roles: ['admin', 'sales', 'warehouse', 'accountant'] },
  { to: '/stock', label: 'Stock', icon: '⇅', roles: ['admin', 'warehouse'] },
  { to: '/customers', label: 'Customers', icon: '☺', roles: ['admin', 'sales', 'accountant'] },
  { to: '/users', label: 'Users', icon: '⚙', roles: ['admin'] },
]

export function Layout() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setMenuOpen(false)
  }
  if (!user) return null

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <img src="/favicon.svg" alt="" width={32} height={32} />
          <div>
            <strong>{user.company.name}</strong>
            <span>Mini ERP</span>
          </div>
          <button
            type="button"
            className="icon-button menu-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            ☰
          </button>
        </div>
        <nav>
          {NAV.filter((item) => item.roles.includes(user.role)).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              <span className="nav-icon" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="whoami">
          <div>
            <strong>{user.name}</strong>
            <span className={`role role-${user.role}`}>{ROLE_LABEL[user.role]}</span>
          </div>
          <span className="muted small">{user.email}</span>
          <button type="button" className="button secondary small" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
      <Toaster />
    </div>
  )
}
