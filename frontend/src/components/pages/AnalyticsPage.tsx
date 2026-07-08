import React from 'react'
import {
  Box,
  Card,
  CardContent,
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

export default function AnalyticsPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => fetchApi<Record<string, unknown>>('/analytics/overview'),
  })

  const { data: recommendations = [] } = useQuery({
    queryKey: ['predictive-recs'],
    queryFn: () => fetchApi<Array<Record<string, unknown>>>('/predictive/recommendations'),
  })

  const { data: risk } = useQuery({
    queryKey: ['risk'],
    queryFn: () => fetchApi<Record<string, unknown>>('/risk'),
  })

  return (
    <AppLayout title="Analytics">
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Analytics Dashboard
      </Typography>
      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 3,
          mb: 3,
        }}
      >
        <Card>
          <CardContent>
            <Typography color="text.secondary">Total Assets</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {String(overview?.total_assets ?? '—')}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="text.secondary">Open Alerts</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>
              {String(overview?.open_alerts ?? '—')}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="text.secondary">Outage Prob. (90d)</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {((risk?.outage_probability_90d as number) * 100)?.toFixed(0) ?? '—'}%
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Predictive Maintenance Recommendations
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Asset</TableCell>
                <TableCell>Action</TableCell>
                <TableCell align="right">Confidence</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recommendations.map((r, i) => (
                <TableRow key={String(r.recommendation_id || i)}>
                  <TableCell>{String(r.priority_rank ?? i + 1)}</TableCell>
                  <TableCell>{String(r.asset_code ?? r.asset_id ?? '—')}</TableCell>
                  <TableCell>{String(r.recommended_action ?? r.action ?? '—')}</TableCell>
                  <TableCell align="right">
                    {((r.confidence_score as number) * 100)?.toFixed(0) ?? '—'}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  )
}
