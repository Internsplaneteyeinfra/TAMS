import React from 'react'
import { useQuery } from '@tanstack/react-query'
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
} from '@/components/mui'
import AppLayout from '@/components/layout/AppLayout'
import { fetchApi } from '@/lib/api'

interface HealthPortfolio {
  average_health_score: number
  distribution: Record<string, number>
  top_risk_assets: Array<{ asset_code: string; risk_score: number; health_score: number }>
  total_assets: number
}

export default function HealthPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: () => fetchApi<HealthPortfolio>('/health'),
  })

  return (
    <AppLayout title="Condition Monitoring">
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Condition Monitoring
      </Typography>
      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 3, mb: 3 }}>
        <Card>
          <CardContent>
            <Typography color="text.secondary">Portfolio Health Score</Typography>
            <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {data?.average_health_score?.toFixed(1) ?? '—'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {data?.total_assets ?? 0} assets scored
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Health Distribution
            </Typography>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {Object.entries(data?.distribution || {}).map(([band, count]) => (
                <Box key={band}>
                  <Typography variant="caption" color="text.secondary">
                    {band}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {count}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Top At-Risk Assets
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Asset</TableCell>
                <TableCell align="right">Health Score</TableCell>
                <TableCell align="right">Risk Score</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.top_risk_assets || []).map((a) => (
                <TableRow key={a.asset_code}>
                  <TableCell>{a.asset_code}</TableCell>
                  <TableCell align="right">{a.health_score?.toFixed(1)}</TableCell>
                  <TableCell align="right">{a.risk_score?.toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  )
}
