import React, { useMemo } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowLeft,
  Bell,
  ClipboardCheck,
  HeartPulse,
  LayoutDashboard,
  Map,
  Mountain,
  RadioTower,
  Satellite,
  Wrench,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import LogoutButton from '@/components/auth/LogoutButton'
import LandingThemeToggle from '@/components/landing/LandingThemeToggle'
import { MODULE_NAV_ITEMS } from '@/config/moduleNav'
import { fetchApi } from '@/lib/api'
import { LandingThemeProvider, useLandingTheme } from '@/theme/LandingThemeContext'
import { landingLightCssVars } from '@/theme/landingTheme'

const OPS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  '/analyzer': Map,
  '/dashboard': LayoutDashboard,
  '/assets': RadioTower,
  '/alarms': Bell,
  '/health': HeartPulse,
  '/maintenance': Wrench,
  '/inspections': ClipboardCheck,
  '/geotech': Mountain,
  '/analytics': Activity,
  '/monitoring': Satellite,
}

interface OpsDashboard {
  active_alarms: number
  assets_monitored: number
  average_health_score: number
  alarms_by_severity: Record<string, number>
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#22c55e',
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
}

export default function DashboardPage() {
  return (
    <LandingThemeProvider>
      <DashboardPageInner />
    </LandingThemeProvider>
  )
}

function DashboardPageInner() {
  const { appearance, isTransitioning, registerLandingEl } = useLandingTheme()
  const router = useRouter()
  const light = appearance === 'light'

  const { data: ops, isLoading } = useQuery({
    queryKey: ['dashboard-operations'],
    queryFn: () => fetchApi<OpsDashboard>('/dashboard/operations'),
  })

  const { data: exec } = useQuery({
    queryKey: ['dashboard-executive'],
    queryFn: () => fetchApi<Record<string, unknown>>('/dashboard/executive'),
  })

  const kpis = (exec?.kpi as Record<string, number>) || {}

  const severityData = useMemo(() => {
    const entries = Object.entries(ops?.alarms_by_severity || {})
    return entries.map(([sev, count]) => ({
      name: sev,
      value: count,
      key: sev.toLowerCase(),
      color: SEVERITY_COLORS[sev.toLowerCase()] || '#64748b',
      emoji: SEVERITY_EMOJI[sev.toLowerCase()] || '⚪',
    }))
  }, [ops])

  const totalAlarms = severityData.reduce((sum, d) => sum + d.value, 0)

  const KPI_CARDS = [
    {
      emoji: '🔔',
      label: 'Active Alarms',
      value: ops?.active_alarms ?? '—',
      color: light ? '#dc2626' : '#f87171',
      href: '/alarms',
    },
    {
      emoji: '🗼',
      label: 'Assets Monitored',
      value: ops?.assets_monitored ?? '—',
      color: light ? '#0891B2' : '#22d3ee',
      href: '/assets',
    },
    {
      emoji: '❤️',
      label: 'Avg Health Score',
      value: ops?.average_health_score?.toFixed(1) ?? '—',
      color: light ? '#059669' : '#34d399',
      href: '/health',
    },
    {
      emoji: '✅',
      label: 'Availability',
      value: `${kpis.availability_pct ?? '—'}%`,
      color: light ? '#d97706' : '#fcd34d',
      href: '/analytics',
    },
  ]

  const RELIABILITY = [
    { emoji: '⏱️', label: 'SAIDI', hint: 'Avg outage time', value: kpis.saidi_minutes ?? '—', unit: 'min', href: '/analytics' },
    { emoji: '🔁', label: 'SAIFI', hint: 'Outage frequency', value: kpis.saifi ?? '—', unit: '', href: '/analytics' },
    { emoji: '🛡️', label: 'MTBF', hint: 'Between failures', value: kpis.mtbf_hours ?? '—', unit: 'hrs', href: '/maintenance' },
    { emoji: '🛠️', label: 'MTTR', hint: 'Time to repair', value: kpis.mttr_hours ?? '—', unit: 'hrs', href: '/maintenance' },
  ]

  const tooltipStyle = light
    ? { borderRadius: 10, fontSize: 13, background: '#ffffff', border: '1px solid #CBD8E2', color: '#0B1726' }
    : { borderRadius: 10, fontSize: 13, background: '#0e172a', border: '1px solid rgba(255,255,255,0.12)', color: '#F4F7FA' }

  return (
    <>
      <Head>
        <title>TAMS · Tower Performance</title>
      </Head>
      <div
        ref={registerLandingEl}
        className={`tams-landing tams-performance-dash min-h-screen flex flex-col relative overflow-hidden bg-[#07111D] ${
          isTransitioning ? 'tams-landing--theme-blend' : ''
        }`}
        data-tams-theme={appearance}
        style={appearance === 'light' && !isTransitioning ? landingLightCssVars() : undefined}
        suppressHydrationWarning
      >
        <div
          className="tams-landing-base pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 18%, rgba(0,110,150,0.10) 0%, rgba(0,60,100,0.05) 30%, transparent 60%), linear-gradient(180deg, #081522 0%, #07111D 45%, #050D17 100%)',
          }}
        />
        <div
          className="tams-landing-glow pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 62% 40% at 50% 0%, rgba(217,119,6,0.08), transparent 70%), radial-gradient(ellipse 42% 34% at 78% 18%, rgba(34,211,238,0.05), transparent 70%)',
          }}
        />

        <header className="tams-landing-header relative z-10 shrink-0 h-14 flex items-center gap-3 px-6 border-b border-[#8fb3c9]/10 bg-[#081522]/40">
          <div className="min-w-0">
            <p className="tams-landing-brand text-[10px] font-bold tracking-[0.28em] text-[#7d94a8] uppercase">
              PlanetEye · TAMS
            </p>
            <h1 className="tams-landing-title text-sm font-black tracking-widest text-[#F4F7FA]">
              Tower Performance
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/alarms"
              className="tams-dash-back relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#0e172a]/45 text-[#F4F7FA] hover:border-cyan-400/40"
              aria-label="Open alarm center"
              title="Alarm Center"
            >
              <Bell className="h-4 w-4" />
              {(ops?.active_alarms ?? 0) > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[1.1rem] rounded-full bg-red-500 px-1 text-center text-[9px] font-black text-white">
                  {ops?.active_alarms}
                </span>
              )}
            </Link>
            <Link
              href="/"
              className="tams-dash-back inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-white/10 bg-[#0e172a]/45 text-xs font-bold text-[#F4F7FA] hover:border-cyan-400/40"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Modules
            </Link>
            <LandingThemeToggle />
            <LogoutButton variant={light ? 'light' : 'dark'} />
          </div>
        </header>

        <div className="relative z-10 flex min-h-0 flex-1">
          <nav
            className="tams-dash-nav hidden md:flex w-60 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[#8fb3c9]/10 bg-[#081522]/35 px-2 py-3"
            aria-label="Operations"
          >
            <p className="tams-landing-kicker px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#7d94a8]">
              Operations
            </p>
            {MODULE_NAV_ITEMS.map((item) => {
              const Icon = OPS_ICONS[item.href] ?? LayoutDashboard
              const active = router.pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`tams-dash-nav-item flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-bold ${
                    active ? 'tams-dash-nav-item--active bg-amber-400/15 text-amber-200' : 'text-[#F4F7FA]/80 hover:bg-white/5 hover:text-[#F4F7FA]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <main className="relative flex-1 overflow-auto px-4 py-6 sm:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <p className="tams-landing-kicker text-[11px] font-bold uppercase tracking-[0.4em] text-[#7d94a8] mb-1">
              Operations dashboard
            </p>
            <h2 className="tams-landing-heading text-2xl sm:text-3xl font-black text-[#F4F7FA] tracking-tight">
              Live grid KPIs
            </h2>
            <p className="tams-mod-sub mt-1.5 text-sm font-semibold text-slate-300/80 max-w-2xl">
              Open any operation from the left menu, or click a KPI to jump into that workspace.
            </p>

            <div className="mt-4 flex flex-wrap gap-2 md:hidden">
              {MODULE_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="tams-dash-back rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-[#F4F7FA]"
                >
                  {item.shortLabel}
                </Link>
              ))}
            </div>

            {isLoading && (
              <div className="mt-4 h-1 rounded-full overflow-hidden bg-white/10">
                <div className="h-full w-1/3 animate-pulse bg-amber-400/80" />
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {KPI_CARDS.map((kpi) => (
                <Link
                  key={kpi.label}
                  href={kpi.href}
                  className="tams-mod-card tams-mod-performance rounded-2xl border border-amber-300/30 bg-[#051423]/[0.78] px-5 py-6 shadow-[0_18px_40px_-18px_rgba(3,10,20,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md text-left hover:-translate-y-0.5"
                  style={{ borderLeftWidth: 4, borderLeftColor: kpi.color }}
                >
                  <p className="tams-mod-sub text-[11px] font-bold uppercase tracking-wider text-slate-300/80">
                    <span className="mr-1.5" aria-hidden>
                      {kpi.emoji}
                    </span>
                    {kpi.label}
                  </p>
                  <p className="tams-mod-title mt-2 text-3xl font-black tabular-nums tracking-tight" style={{ color: kpi.color }}>
                    {kpi.value}
                  </p>
                </Link>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="tams-mod-card tams-mod-performance rounded-2xl border border-amber-300/30 bg-[#051423]/[0.78] p-5 shadow-[0_18px_40px_-18px_rgba(3,10,20,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="tams-mod-title text-base font-black text-[#F4F7FA]">Alarms by severity</h3>
                  <Link href="/alarms" className="tams-mod-sub text-[11px] font-bold uppercase tracking-wider hover:underline">
                    Open alarm center →
                  </Link>
                </div>
                {severityData.length === 0 ? (
                  <p className="tams-mod-sub py-10 text-center text-sm font-semibold text-slate-300/80">
                    No alarms right now
                  </p>
                ) : (
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <div className="relative h-[180px] w-[180px] shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={severityData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={58}
                            outerRadius={82}
                            paddingAngle={2}
                            stroke="none"
                          >
                            {severityData.map((d) => (
                              <Cell key={d.key} fill={d.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number, name: string) => [`${value} alarms`, name]}
                            contentStyle={tooltipStyle}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <p className="tams-mod-title text-[28px] font-black leading-none tabular-nums">{totalAlarms}</p>
                        <p className="tams-mod-sub text-[11px] font-bold uppercase tracking-wider">total</p>
                      </div>
                    </div>
                    <div className="flex min-w-[150px] flex-1 flex-col gap-2">
                      {severityData.map((d) => (
                        <Link key={d.key} href="/alarms" className="flex items-center gap-2">
                          <span aria-hidden>{d.emoji}</span>
                          <span className="tams-mod-title flex-1 text-sm font-bold capitalize">{d.name}</span>
                          <span className="text-base font-black tabular-nums" style={{ color: d.color }}>
                            {d.value}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="tams-mod-card tams-mod-performance rounded-2xl border border-amber-300/30 bg-[#051423]/[0.78] p-5 shadow-[0_18px_40px_-18px_rgba(3,10,20,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="tams-mod-title text-base font-black text-[#F4F7FA]">Reliability</h3>
                  <Link href="/analytics" className="tams-mod-sub text-[11px] font-bold uppercase tracking-wider hover:underline">
                    Open analytics →
                  </Link>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {RELIABILITY.map((r) => (
                    <Link
                      key={r.label}
                      href={r.href}
                      className="tams-dash-stat rounded-xl border border-white/10 bg-[#081522]/55 px-3 py-3 hover:border-amber-300/40"
                    >
                      <p className="tams-mod-title text-xl font-black tabular-nums leading-none">
                        {r.value}
                        {r.unit ? (
                          <span className="tams-mod-sub ml-1 text-[11px] font-bold">{r.unit}</span>
                        ) : null}
                      </p>
                      <p className="tams-mod-title mt-1.5 text-xs font-black">{r.label}</p>
                      <p className="tams-mod-sub text-[11px] font-semibold">{r.hint}</p>
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          </div>
          </main>
        </div>
      </div>
    </>
  )
}
