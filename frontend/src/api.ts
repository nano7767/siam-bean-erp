const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

const SESSION_KEY = 'siam-bean-session'

export type Role = 'admin' | 'sales' | 'warehouse' | 'accountant'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  active: boolean
  company: { id: number; name: string }
}

export interface Session {
  access_token: string
  refresh_token: string
  user: User
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // Private mode: the session simply lasts until the tab closes.
  }
}

let onSessionExpired: () => void = () => {}
export function setOnSessionExpired(handler: () => void) {
  onSessionExpired = handler
}

async function send(path: string, init: RequestInit, token?: string): Promise<Response> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  try {
    return await fetch(`${API_URL}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your internet connection and try again.')
  }
}

async function errorFrom(response: Response): Promise<ApiError> {
  let message = `Something went wrong (${response.status}). Please try again.`
  try {
    const body = await response.json()
    if (typeof body.detail === 'string') message = body.detail
  } catch {
    // keep the generic message
  }
  return new ApiError(response.status, message)
}

let refreshing: Promise<Session | null> | null = null

async function refreshSession(): Promise<Session | null> {
  const current = loadSession()
  if (!current) return null
  const response = await send('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: current.refresh_token }),
  })
  if (!response.ok) return null
  const session = (await response.json()) as Session
  saveSession(session)
  return session
}

/** Call the API with the logged-in user's token. Refreshes the token once on 401. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await send(path, init, loadSession()?.access_token)
  if (response.status === 401 && loadSession()) {
    refreshing ??= refreshSession().finally(() => (refreshing = null))
    const session = await refreshing
    if (!session) {
      saveSession(null)
      onSessionExpired()
      throw new ApiError(401, 'Your session has expired, please log in again')
    }
    response = await send(path, init, session.access_token)
  }
  if (!response.ok) throw await errorFrom(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) })

export const put = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PUT', body: JSON.stringify(body) })

export async function login(email: string, password: string): Promise<Session> {
  const response = await send('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) throw await errorFrom(response)
  const session = (await response.json()) as Session
  saveSession(session)
  return session
}

export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}
