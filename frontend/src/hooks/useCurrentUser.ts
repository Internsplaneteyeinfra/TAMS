import { useEffect, useState } from 'react'

import { fetchCurrentUser, type AuthUser } from '@/lib/auth/client'

const LOGIN_USER_KEY = 'tams-login-user'

function readCachedUsername(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = window.localStorage.getItem(LOGIN_USER_KEY)
    return saved?.trim() || null
  } catch {
    return null
  }
}

/**
 * Logged-in operator for UI labels (analyzer profile, headers, etc.).
 * Prefers JWT `/api/auth/me`; falls back briefly to last login username.
 */
export function useCurrentUser(): {
  user: AuthUser | null
  username: string
  loading: boolean
} {
  const cached = readCachedUsername()
  const [user, setUser] = useState<AuthUser | null>(
    cached ? { username: cached, role: 'operator' } : null
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const me = await fetchCurrentUser()
      if (cancelled) return
      if (me) {
        setUser(me)
        try {
          window.localStorage.setItem(LOGIN_USER_KEY, me.username)
        } catch {
          /* ignore */
        }
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return {
    user,
    username: user?.username || cached || 'Operator',
    loading,
  }
}
