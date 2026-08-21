import React, { useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Box, Button, Card, CardContent, LinearProgress, Typography } from '@/components/mui'
import AppLayout from '@/components/layout/AppLayout'
import { fetchApi } from '@/lib/api'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

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
    { emoji: '🔔', label: 'Active Alarms', value: ops?.active_alarms ?? '—', color: '#ef4444' },
    { emoji: '🗼', label: 'Assets Monitored', value: ops?.assets_monitored ?? '—', color: '#3b82f6' },
    { emoji: '❤️', label: 'Avg Health Score', value: ops?.average_health_score?.toFixed(1) ?? '—', color: '#22c55e' },
    { emoji: '✅', label: 'Availability', value: `${kpis.availability_pct ?? '—'}%`, color: '#06b6d4' },
  ]

  const RELIABILITY = [
    { emoji: '⏱️', label: 'SAIDI', hint: 'Avg outage time', value: kpis.saidi_minutes ?? '—', unit: 'min' },
    { emoji: '🔁', label: 'SAIFI', hint: 'Outage frequency', value: kpis.saifi ?? '—', unit: '' },
    { emoji: '🛡️', label: 'MTBF', hint: 'Between failures', value: kpis.mtbf_hours ?? '—', unit: 'hrs' },
    { emoji: '🛠️', label: 'MTTR', hint: 'Time to repair', value: kpis.mttr_hours ?? '—', unit: 'hrs' },
  ]

  return (
    <AppLayout title="Tower Performance" alarmCount={ops?.active_alarms}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1 }}>
        <Box>
          <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1.2, color: 'text.secondary' }}>
            Tower Performance
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Operations Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Live KPIs, alarm severity, and reliability metrics for the monitored grid.
          </Typography>
        </Box>
        <Button
          component={Link}
          href="/"
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          aria-label="Back to module selection"
          sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 700 }}
        >
          Back to modules
        </Button>
      </Box>
      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {/* KPI cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2.5,
          mb: 3,
        }}
      >
        {KPI_CARDS.map((kpi) => (
          <Card key={kpi.label} sx={{ borderLeft: `5px solid ${kpi.color}` }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ fontSize: 34, lineHeight: 1 }} aria-hidden>{kpi.emoji}</Box>
              <Box>
                <Typography color="text.secondary" sx={{ fontSize: 15, fontWeight: 600 }}>
                  {kpi.label}
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 30, color: kpi.color, lineHeight: 1.1 }}>
                  {kpi.value}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* Alarms by severity — donut */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
              🔔 Alarms by Severity
            </Typography>
            {severityData.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No alarms right now 🎉
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ position: 'relative', width: 180, height: 180 }}>
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
                        contentStyle={{ borderRadius: 8, fontSize: 13 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <Typography sx={{ fontWeight: 800, fontSize: 28, lineHeight: 1 }}>{totalAlarms}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>total</Typography>
                  </Box>
                </Box>
                {/* Legend with big labels */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 150 }}>
                  {severityData.map((d) => (
                    <Box key={d.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span aria-hidden style={{ fontSize: 16 }}>{d.emoji}</span>
                      <Typography sx={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{d.name}</Typography>
                      <Typography sx={{ fontSize: 16, fontWeight: 800, color: d.color }}>{d.value}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Reliability KPIs — big stat cards */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
              📈 Reliability
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              {RELIABILITY.map((r) => (
                <Box
                  key={r.label}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'action.hover',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ fontSize: 26 }} aria-hidden>{r.emoji}</Box>
                  <Box>
                    <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>
                      {r.value}
                      {r.unit && <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 3 }}>{r.unit}</span>}
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{r.label}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{r.hint}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>
    </AppLayout>
  )
}
