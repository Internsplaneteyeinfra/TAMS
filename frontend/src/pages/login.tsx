/**
 * TAMS Login — JWT session gate before module selection.
 * Dark theme only (landing theme toggle is separate).
 */

import React, { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { Manrope, Sora } from 'next/font/google'
import { Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from 'lucide-react'

import { loginRequest } from '@/lib/auth/client'
import styles from './login.module.css'

const USER_KEY = 'tams-login-user'

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
  loading: () => null,
})

export default function LoginPage() {
  const router = useRouter()
  const userRef = useRef<HTMLInputElement>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsOn, setCapsOn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [shake, setShake] = useState(false)
  const [bgReady, setBgReady] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(USER_KEY)
      if (saved) setUsername(saved)
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => setMounted(true), 40)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const id = window.setTimeout(() => userRef.current?.focus(), 280)
    return () => window.clearTimeout(id)
  }, [mounted])

  const checkCaps = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('getModifierState' in e) setCapsOn(e.getModifierState('CapsLock'))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    const result = await loginRequest(username.trim(), password)
    if (!result.ok) {
      setError(result.error || 'Invalid credentials. Check username and password.')
      setBusy(false)
      setShake(true)
      window.setTimeout(() => setShake(false), 520)
      return
    }
    try {
      window.localStorage.setItem(USER_KEY, username.trim())
    } catch {
      /* ignore */
    }
    const next =
      typeof router.query.next === 'string' && router.query.next.startsWith('/')
        ? router.query.next
        : '/'
    window.location.href = next
  }

  const reveal = (delayMs: number) =>
    ({
      transitionDelay: mounted ? `${delayMs}ms` : '0ms',
    }) as React.CSSProperties

  const canSubmit = username.trim().length > 0 && password.length > 0 && !busy

  return (
    <>
      <Head>
        <title>TAMS · Sign in</title>
      </Head>
      <div
        className={`${styles.page} ${sora.variable} ${manrope.variable}`}
        style={{ fontFamily: 'var(--font-login-body), system-ui, sans-serif' }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            background: 'linear-gradient(165deg, #081522 0%, #050d17 50%, #040a12 100%)',
            opacity: bgReady ? 0 : 1,
            transition: 'opacity 0.4s ease',
            pointerEvents: 'none',
          }}
        />
        <LoginTowerBackground onReady={() => setBgReady(true)} />

        <div className={styles.content}>
          <header
            className={`${styles.header} ${styles.reveal} ${mounted ? styles.revealIn : ''}`}
            style={reveal(20)}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden p-1 border border-cyan-300/40 bg-white/15 backdrop-blur-md shadow-[0_0_20px_rgba(34,211,238,0.25)]">
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
            <div className={styles.panel}>
              <div
                className={`mb-6 ${styles.reveal} ${mounted ? styles.revealIn : ''}`}
                style={reveal(80)}
              >
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
                <p className={styles.helper}>
                  Access the command center to run suitability, analyzer, and grid workflows.
                </p>
                <div className={styles.statusChip} aria-hidden>
                  <span className={styles.statusDot} />
                  Encrypted session
                </div>
              </div>

              <form
                onSubmit={(e) => void onSubmit(e)}
                className={`${styles.formCard} ${styles.reveal} ${mounted ? styles.revealIn : ''} ${shake ? styles.shake : ''
                  } space-y-4`}
                style={reveal(140)}
                noValidate
              >
                <label className="block relative z-[1]">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${styles.label}`}
                    style={{ fontFamily: 'var(--font-login-display), sans-serif' }}
                  >
                    Username
                  </span>
                  <div className="mt-1.5 relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-cyan-200/70" />
                    <input
                      ref={userRef}
                      autoComplete="username"
                      name="username"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value)
                        if (error) setError(null)
                      }}
                      onKeyUp={checkCaps}
                      className={styles.input}
                      placeholder="Enter your username"
                      required
                      aria-invalid={!!error}
                    />
                  </div>
                </label>

                <label className="block relative z-[1]">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${styles.label}`}
                      style={{ fontFamily: 'var(--font-login-display), sans-serif' }}
                    >
                      Password
                    </span>
                    {capsOn && (
                      <span className={styles.capsWarn} role="status">
                        Caps Lock is on
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-cyan-200/70" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      name="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (error) setError(null)
                      }}
                      onKeyUp={checkCaps}
                      onKeyDown={checkCaps}
                      className={styles.input}
                      style={{ paddingRight: '2.75rem' }}
                      placeholder="Enter your password"
                      required
                      aria-invalid={!!error}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-cyan-100 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                {error && (
                  <div role="alert" className={`relative z-[1] ${styles.errorBox}`}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`${styles.cta} relative z-[1]`}
                  aria-busy={busy}
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-[#0e5f6d] via-[#17879a] to-[#2a9fb0]" />
                  <span className={styles.ctaShine} aria-hidden />
                  <span
                    className="relative inline-flex items-center justify-center gap-2"
                    style={{ fontFamily: 'var(--font-login-display), sans-serif' }}
                  >
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

                <p className={`relative z-[1] ${styles.footHint}`}>
                  Press <kbd className={styles.kbd}>Enter</kbd> to sign in · session secured with JWT
                </p>
              </form>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
