export type AuthUser = { username: string; role: string }

export async function loginRequest(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password }),
    })
    if (res.ok) return { ok: true }
    let message =
      res.status === 401
        ? 'Invalid username or password'
        : res.status >= 500
          ? 'Sign-in service unavailable. Please try again.'
          : 'Unable to sign in. Please try again.'
    try {
      const data = (await res.json()) as { error?: string }
      if (data?.error) message = data.error
    } catch {
      /* ignore non-JSON error bodies */
    }
    return { ok: false, error: message }
  } catch {
    return {
      ok: false,
      error: 'Cannot reach the sign-in service. Is the app running on http://localhost:3000?',
    }
  }
}

/** Session user from HttpOnly JWT cookie (`GET /api/auth/me`). */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      authenticated?: boolean
      user?: { username?: string; role?: string }
    }
    if (!data?.authenticated || !data.user?.username) return null
    return {
      username: data.user.username,
      role: data.user.role || 'operator',
    }
  } catch {
    return null
  }
}

/** Initials for avatar chip — VishalBhor → VB, ShwetaPawar → SP. */
export function initialsFromUsername(username: string): string {
  const parts = username
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[\s._-]+/)
    .filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }
  return username.trim().slice(0, 2).toUpperCase() || '??'
}

export async function logoutRequest(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    })
  } catch {
    /* still redirect to login */
  }
}

/** Clear session and hard-navigate to login (avoids stale SPA state). */
export async function logoutAndRedirect(): Promise<void> {
  await logoutRequest()
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}
