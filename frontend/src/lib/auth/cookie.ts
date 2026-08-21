export const AUTH_COOKIE_NAME = 'tams_token'

export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours

export function buildAuthCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE}${secure}`
}

export function clearAuthCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}

export function readTokenFromCookieHeader(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAME}=([^;]*)`))
  return match?.[1] ? decodeURIComponent(match[1]) : null
}
