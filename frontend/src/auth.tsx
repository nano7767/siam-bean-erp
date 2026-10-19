import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { login as apiLogin, loadSession, saveSession, setOnSessionExpired, type Role, type User } from './api'

interface AuthState {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  can: (...roles: Role[]) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadSession()?.user ?? null)

  useEffect(() => setOnSessionExpired(() => setUser(null)), [])

  const value: AuthState = {
    user,
    async login(email, password) {
      const session = await apiLogin(email, password)
      setUser(session.user)
    },
    logout() {
      saveSession(null)
      setUser(null)
    },
    can: (...roles) => !!user && roles.includes(user.role),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const state = useContext(AuthContext)
  if (!state) throw new Error('useAuth must be used inside <AuthProvider>')
  return state
}
