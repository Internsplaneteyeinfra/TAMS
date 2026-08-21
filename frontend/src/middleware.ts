import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { AUTH_COOKIE_NAME } from '@/lib/auth/cookie'
import { verifyAccessToken } from '@/lib/auth/jwt'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/me']

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  if (pathname.startsWith('/_next')) return true
  if (pathname.startsWith('/favicon')) return true
  if (pathname.startsWith('/models')) return true
  if (pathname.startsWith('/cesium')) return true
  if (pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|map|woff2?)$/)) return true
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) {
    if (pathname === '/login') {
      const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
      if (token && (await verifyAccessToken(token))) {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }
    return NextResponse.next()
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  if (!token || !(await verifyAccessToken(token))) {
    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/') {
      loginUrl.searchParams.set('next', pathname)
    }
    const res = NextResponse.redirect(loginUrl)
    if (token) {
      res.cookies.set(AUTH_COOKIE_NAME, '', { path: '/', maxAge: 0 })
    }
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
