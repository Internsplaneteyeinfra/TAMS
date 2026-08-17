import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Box, Card, CardContent, LinearProgress, Typography } from '@/components/mui'
import AppLayout from '@/components/layout/AppLayout'
import { fetchApi } from '@/lib/api'

interface AnalyticsOverview {
  total_assets: number
  assets_by_type: Record<string, number>
  health_distribution: Record<string, number>
  open_alerts: number
  average_health_score: number
}

const TYPE_META: Record<string, { color: string; emoji: string; label: string }> = {
  tower: { color: '#ef4444', emoji: '🗼', label: 'Towers' },
  line: { color: '#22c55e', emoji: '🔌', label: 'Power Lines' },
  substation: { color: '#3b82f6', emoji: '🏭', label: 'Substations' },
}

const HEALTH_META: Record<string, { color: string; emoji: string; label: string }> = {
  healthy: { color: '#22c55e', emoji: '🟢', label: 'Healthy' },
  attention_required: { color: '#f59e0b', emoji: '🟡', label: 'Attention' },
  critical: { color: '#ef4444', emoji: '🔴', label: 'Critical' },
}

export default function AnalyticsPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => fetchApi<AnalyticsOverview>('/analytics/overview'),
  })

  const { data: recommendations = [] } = useQuery({
    queryKey: ['predictive-recs'],
    queryFn: () => fetchApi<Array<Record<string, unknown>>>('/predictive/recommendations'),
  })

  const { data: risk } = useQuery({
    queryKey: ['risk'],
    queryFn: () => fetchApi<Record<string, unknown>>('/risk'),
  })

  const typeData = useMemo(
    () =>
      Object.entries(overview?.assets_by_type || {}).map(([type, count]) => ({
        name: TYPE_META[type]?.label ?? type,
        value: count,
        fill: TYPE_META[type]?.color ?? '#64748b',
        emoji: TYPE_META[type]?.emoji ?? '⚪',
      })),
    [overview]
  )

  const healthData = useMemo(
    () =>
      Object.entries(overview?.health_distribution || {}).map(([band, count]) => ({
        name: HEALTH_META[band]?.label ?? band,
        value: count,
        key: band,
        color: HEALTH_META[band]?.color ?? '#64748b',
        emoji: HEALTH_META[band]?.emoji ?? '⚪',
      })),
    [overview]
  )

  const outageProb = risk?.outage_probability_90d != null
    ? `${((risk.outage_probability_90d as number) * 100).toFixed(0)}%`
    : '—'

  const KPI_CARDS = [
    { emoji: '🗼', label: 'Total Assets', value: overview?.total_assets?.toLocaleString() ?? '—', color: '#3b82f6' },
    { emoji: '🔔', label: 'Open Alerts', value: overview?.open_alerts ?? '—', color: '#ef4444' },
    { emoji: '⚠️', label: 'Outage Risk (90d)', value: outageProb, color: '#f59e0b' },
    { emoji: '❤️', label: 'Avg Health', value: overview?.average_health_score?.toFixed(1) ?? '—', color: '#22c55e' },
  ]

  const totalHealth = healthData.reduce((s, d) => s + d.value, 0)

  return (
    <AppLayout title="Analytics">
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 800 }}>
        📈 Analytics
      </Typography>
      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {/* KPI cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2.5, mb: 3 }}>
        {KPI_CARDS.map((kpi) => (
          <Card key={kpi.label} sx={{ borderLeft: `5px solid ${kpi.color}` }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ fontSize: 34, lineHeight: 1 }} aria-hidden>{kpi.emoji}</Box>
              <Box>
                <Typography color="text.secondary" sx={{ fontSize: 15, fontWeight: 600 }}>{kpi.label}</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 30, color: kpi.color, lineHeight: 1.1 }}>{kpi.value}</Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
        {/* Assets by type — horizontal bar chart */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>🗂️ Assets by Type</Typography>
            <Box sx={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} layout="vertical" margin={{ left: 10, right: 20, top: 6, bottom: 6 }}>
                  <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 13 }} width={90} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toLocaleString()} assets`, '']}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                    cursor={{ fill: 'rgba(148,163,184,0.1)' }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={26}>
                    {typeData.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Health distribution — donut */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>❤️ Asset Health</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ position: 'relative', width: 180, height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={healthData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none">
                      {healthData.map((d) => (
                        <Cell key={d.key} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [`${value.toLocaleString()}`, name]} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 26, lineHeight: 1 }}>{totalHealth.toLocaleString()}</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>assets</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 150 }}>
                {healthData.map((d) => (
                  <Box key={d.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span aria-hidden style={{ fontSize: 16 }}>{d.emoji}</span>
                    <Typography sx={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{d.name}</Typography>
                    <Typography sx={{ fontSize: 16, fontWeight: 800, color: d.color }}>{d.value.toLocaleString()}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Predictive maintenance — ranked cards with confidence bars */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
            🔮 Predictive Maintenance — What to fix next
          </Typography>
          {recommendations.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              No recommendations right now ✅
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {recommendations.slice(0, 8).map((r, i) => {
                const confidence = Math.round(((r.confidence_score as number) ?? 0) * 100)
                const rank = Number(r.priority_rank ?? i + 1)
                return (
                  <Box
                    key={String(r.recommendation_id || i)}
                    sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', gap: 2 }}
                  >
                    <Box
                      sx={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        bgcolor: rank <= 2 ? '#ef4444' : rank <= 4 ? '#f59e0b' : '#3b82f6',
                        color: '#fff', fontWeight: 800, fontSize: 15,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {rank}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
                        {String(r.asset_code ?? r.asset_id ?? 'Asset')}
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                        {String(r.recommended_action ?? r.action ?? 'Inspect asset')}
                      </Typography>
                    </Box>
                    <Box sx={{ width: 120, flexShrink: 0 }}>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
                        Confidence {confidence}%
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={confidence}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>
                  </Box>
                )
              })}
            </Box>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  )
}
