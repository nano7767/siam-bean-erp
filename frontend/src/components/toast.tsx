import { useEffect, useState } from 'react'

type Listener = (message: string) => void
const listeners = new Set<Listener>()

/** Show a short success message at the bottom of the screen. */
// eslint-disable-next-line react-refresh/only-export-components
export function notify(message: string) {
  listeners.forEach((listener) => listener(message))
}

export function Toaster() {
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const listener: Listener = (text) => {
      setMessage(text)
      clearTimeout(timer)
      timer = setTimeout(() => setMessage(null), 3500)
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
      clearTimeout(timer)
    }
  }, [])
  if (!message) return null
  return (
    <div className="toast" role="status">
      ✓ {message}
    </div>
  )
}
