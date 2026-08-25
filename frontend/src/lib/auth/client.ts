export async function loginRequest(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
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
