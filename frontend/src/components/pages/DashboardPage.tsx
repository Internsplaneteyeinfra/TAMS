import React from 'react'
import {
  Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import AppLayout from '@/components/layout/AppLayout'
import { fetchApi } from '@/lib/api'

interface OpsDashboard {
  active_alarms: number
  assets_monitored: number
  average_health_score: number
  alarms_by_severity: Record<string, number>
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

  return (
    <AppLayout title="Operations" alarmCount={ops?.active_alarms}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Operations Dashboard
      </Typography>
      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 3,
          mb: 3,
        }}
      >
        {[
          { label: 'Active Alarms', value: ops?.active_alarms ?? '—', color: 'error.main' },
          { label: 'Assets Monitored', value: ops?.assets_monitored ?? '—', color: 'primary.main' },
          { label: 'Avg Health Score', value: ops?.average_health_score?.toFixed(1) ?? '—', color: 'success.main' },
          { label: 'Availability', value: `${kpis.availability_pct ?? '—'}%`, color: 'info.main' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                {kpi.label}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: kpi.color }}>
                {kpi.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Alarms by Severity
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {Object.entries(ops?.alarms_by_severity || {}).map(([sev, count]) => (
                <Chip key={sev} label={`${sev}: ${count}`} />
              ))}
            </Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Reliability KPIs
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>KPI</TableCell>
                  <TableCell align="right">Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>SAIDI (min)</TableCell>
                  <TableCell align="right">{kpis.saidi_minutes ?? '—'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>SAIFI</TableCell>
                  <TableCell align="right">{kpis.saifi ?? '—'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>MTBF (hrs)</TableCell>
                  <TableCell align="right">{kpis.mtbf_hours ?? '—'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>MTTR (hrs)</TableCell>
                  <TableCell align="right">{kpis.mttr_hours ?? '—'}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Box>
    </AppLayout>
  )
}
