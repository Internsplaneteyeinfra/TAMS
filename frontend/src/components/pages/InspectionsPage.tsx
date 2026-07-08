import React from 'react'
import {
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
import { useQuery } from '@tanstack/react-query'
import AppLayout from '@/components/layout/AppLayout'
import { fetchApi } from '@/lib/api'

interface Inspection {
  id: string
  asset_code?: string
  inspection_type: string
  status: string
  inspector_name?: string
  overall_score?: number
  summary?: string
}

export default function InspectionsPage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['inspections'],
    queryFn: () => fetchApi<Inspection[]>('/inspections?page_size=100'),
  })

  return (
    <AppLayout title="Inspections">
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Inspection Portal
      </Typography>
      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      <Card>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Asset</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Inspector</TableCell>
              <TableCell align="right">Score</TableCell>
              <TableCell>Summary</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Chip label={r.inspection_type} size="small" />
                </TableCell>
                <TableCell>{r.asset_code || '—'}</TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell>{r.inspector_name || '—'}</TableCell>
                <TableCell align="right">{r.overall_score ?? '—'}</TableCell>
                <TableCell>{r.summary || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  )
}
