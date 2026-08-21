/**
 * TAMS Login — JWT session gate before module selection.
 */

import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { Manrope, Sora } from 'next/font/google'
import { Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from 'lucide-react'

import { loginRequest } from '@/lib/auth/client'
import styles from './login.module.css'

const sora = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-login-display',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-login-body',
  display: 'swap',
})

const LoginTowerBackground = dynamic(() => import('@/components/LoginTowerBackground'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        background: '#050d17',
        pointerEvents: 'none',
      }}
    />
  ),
})

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 40)
    return () => window.clearTimeout(t)
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    const result = await loginRequest(username, password)
    if (!result.ok) {
      setError(result.error || 'Login failed')
      setBusy(false)
      return
    }
    const next =
      typeof router.query.next === 'string' && router.query.next.startsWith('/')
        ? router.query.next
        : '/'
    window.location.href = next
  }

  return (
    <>
      <Head>
        <title>TAMS · Sign in</title>
      </Head>
      <div
        className={`${styles.page} ${sora.variable} ${manrope.variable}`}
        style={{ fontFamily: 'var(--font-login-body), system-ui, sans-serif' }}
      >
        <LoginTowerBackground />

        <div className={styles.content}>
          <header className={styles.header}>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/50 bg-white/40 backdrop-blur-md overflow-hidden p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/favicon.svg" alt="TAMS" width={28} height={28} className="h-7 w-7 object-contain" />
              </span>
              <div>
                <p
                  className={`text-[10px] font-semibold tracking-[0.28em] uppercase ${styles.brandMuted}`}
                  style={{ fontFamily: 'var(--font-login-display), sans-serif' }}
                >
                  PlanetEye · TAMS
                </p>
                <h1
                  className={`text-sm font-bold tracking-[0.12em] ${styles.brandTitle}`}
                  style={{ fontFamily: 'var(--font-login-display), sans-serif' }}
                >
                  Secure Access
                </h1>
              </div>
            </div>
          </header>

          <main className={styles.main}>
            <div
              className={`${styles.panel} transition-all duration-700 ease-out ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              <div className="mb-6">
                <p
                  className={`text-[11px] font-semibold uppercase tracking-[0.32em] mb-2 ${styles.eyebrow}`}
                  style={{ fontFamily: 'var(--font-login-display), sans-serif' }}
                >
                  Transmission Tower · Panel Analyze
                </p>
                <h2
                  className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${styles.title}`}
                  style={{ fontFamily: 'var(--font-login-display), sans-serif' }}
                >
                  Sign in to TAMS
                </h2>
              </div>

              <form onSubmit={(e) => void onSubmit(e)} className={`${styles.formCard} space-y-4`}>
                <label className="block">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${styles.label}`}
                    style={{ fontFamily: 'var(--font-login-display), sans-serif' }}
                  >
                    Username
                  </span>
                  <div className="mt-1.5 relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-200/70" />
                    <input
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={styles.input}
                      placeholder="Admin"
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${styles.label}`}
                    style={{ fontFamily: 'var(--font-login-display), sans-serif' }}
                  >
                    Password
                  </span>
                  <div className="mt-1.5 relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-200/70" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={styles.input}
                      style={{ paddingRight: '2.75rem' }}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-cyan-100 hover:bg-white/10"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-300/35 bg-rose-500/15 backdrop-blur-md px-3 py-2.5 text-sm font-medium text-rose-100"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="group relative w-full h-12 rounded-xl overflow-hidden text-[15px] font-bold tracking-[0.04em] text-white disabled:opacity-70"
                  style={{ fontFamily: 'var(--font-login-display), sans-serif' }}
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-[#126b79] via-[#17879a] to-[#2a8fa0] transition-transform duration-500 group-hover:scale-[1.03]" />
                  <span className="relative inline-flex items-center justify-center gap-2">
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Authenticating…
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        Enter Command Center
                      </>
                    )}
                  </span>
                </button>
              </form>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
