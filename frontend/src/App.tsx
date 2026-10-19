import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider, useAuth } from './auth'
import { Layout } from './components/Layout'
import { Empty } from './components/ui'
import { Accounting } from './pages/Accounting'
import { Customers } from './pages/Customers'
import { Dashboard } from './pages/Dashboard'
import { InvoiceDetail } from './pages/InvoiceDetail'
import { Invoices } from './pages/Invoices'
import { Login } from './pages/Login'
import { OrderDetail } from './pages/OrderDetail'
import { OrderForm } from './pages/OrderForm'
import { Orders } from './pages/Orders'
import { Products } from './pages/Products'
import { Stock } from './pages/Stock'
import { StockCard } from './pages/StockCard'
import { Users } from './pages/Users'

function RequireLogin() {
  const { user } = useAuth()
  return user ? <Layout /> : <Navigate to="/login" replace />
}

// Screens are not hidden by role here on purpose: each one asks the API, and a 403
// from the server is what shows the Access denied page (US-3).
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireLogin />}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/new" element={<OrderForm />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="orders/:id/edit" element={<OrderForm />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="invoices/:id" element={<InvoiceDetail />} />
            <Route path="accounting" element={<Accounting />} />
            <Route path="products" element={<Products />} />
            <Route path="products/:id" element={<StockCard />} />
            <Route path="stock" element={<Stock />} />
            <Route path="customers" element={<Customers />} />
            <Route path="users" element={<Users />} />
            <Route path="*" element={<Empty>Page not found.</Empty>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
