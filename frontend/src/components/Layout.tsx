import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import type { Role } from '../api'
import { useAuth } from '../auth'
import { ROLE_LABEL } from '../format'
import { Icon, type IconName } from './icons'
import { Toaster } from './toast'
import { Avatar } from './ui'

const NAV: { to: string; label: string; icon: IconName; roles: Role[]; section: string }[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', roles: ['admin', 'sales', 'warehouse', 'accountant'], section: 'Overview' },
  { to: '/orders', label: 'Sales orders', icon: 'orders', roles: ['admin', 'sales', 'accountant'], section: 'Sales' },
  { to: '/invoices', label: 'Invoices', icon: 'invoice', roles: ['admin', 'sales', 'accountant'], section: 'Sales' },
  { to: '/accounting', label: 'Accounting', icon: 'wallet', roles: ['admin', 'accountant'], section: 'Sales' },
  { to: '/products', label: 'Products', icon: 'coffee', roles: ['admin', 'sales', 'warehouse', 'accountant'], section: 'Inventory' },
  { to: '/stock', label: 'Stock', icon: 'box', roles: ['admin', 'warehouse'], section: 'Inventory' },
  { to: '/customers', label: 'Customers', icon: 'store', roles: ['admin', 'sales', 'accountant'], section: 'Master data' },
  { to: '/users', label: 'Users', icon: 'users', roles: ['admin'], section: 'Master data' },
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

  const items = NAV.filter((item) => item.roles.includes(user.role))
  const sections = [...new Set(items.map((item) => item.section))]

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <img src="/favicon.svg" alt="" width={36} height={36} />
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
            <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
          </button>
        </div>
        <nav>
          {sections.map((section) => (
            <div key={section} className="nav-section">
              <span className="nav-heading">{section}</span>
              {items
                .filter((item) => item.section === section)
                .map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                    <Icon name={item.icon} />
                    {item.label}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="whoami">
          <div className="whoami-card">
            <Avatar name={user.name} />
            <div className="whoami-text">
              <strong>{user.name}</strong>
              <span className={`role role-${user.role}`}>{ROLE_LABEL[user.role]}</span>
            </div>
          </div>
          <span className="whoami-email">{user.email}</span>
          <button type="button" className="button sidebar-logout small" onClick={logout}>
            <Icon name="logout" size={16} />
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
