import React from 'react'
import {
  Box,
  Button,
  Card,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AppLayout from '@/components/layout/AppLayout'
import { fetchApi, acknowledgeAlarm, type Alert } from '@/lib/api'
import { severityColor } from '@/theme/tamsTheme'

export default function AlarmsPage() {
  const queryClient = useQueryClient()

  const { data: alarms = [], isLoading } = useQuery({
    queryKey: ['alarms'],
    queryFn: () => fetchApi<Alert[]>('/alarms?page_size=100'),
  })

  const { data: summary } = useQuery({
    queryKey: ['alarms-summary'],
    queryFn: () => fetchApi<{ active: number; by_severity: Record<string, number> }>('/alarms/summary'),
  })

  const ackMutation = useMutation({
    mutationFn: (id: string) => acknowledgeAlarm(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alarms'] }),
  })

  return (
    <AppLayout title="Alarm Center" alarmCount={summary?.active}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Alarm Center
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {Object.entries(summary?.by_severity || {}).map(([sev, n]) => (
          <Chip key={sev} label={`${sev}: ${n}`} sx={{ bgcolor: severityColor(sev), color: '#fff' }} />
        ))}
      </Box>
      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      <Card>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Severity</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Asset</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {alarms.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Chip
                    label={(a as Alert & { severity?: string }).severity || a.priority}
                    size="small"
                    sx={{
                      bgcolor: severityColor((a as Alert & { severity?: string }).severity || a.priority),
                      color: '#fff',
                    }}
                  />
                </TableCell>
                <TableCell>{a.title}</TableCell>
                <TableCell>{a.asset_id}</TableCell>
                <TableCell>{a.status}</TableCell>
                <TableCell align="right">
                  {a.status === 'open' || a.status === 'Active' ? (
                    <Button size="small" onClick={() => ackMutation.mutate(a.id)}>
                      Acknowledge
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  )
}
