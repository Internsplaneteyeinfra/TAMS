import React from 'react'
import { useQuery } from '@tanstack/react-query'
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
} from '@/components/mui'
import AppLayout from '@/components/layout/AppLayout'
import { fetchApi } from '@/lib/api'

interface WorkOrder {
  id: string
  work_order_number: string
  asset_code?: string
  maintenance_type: string
  priority: string
  status: string
  description?: string
  assigned_crew?: string
}

export default function MaintenancePage() {
  const { data: wos = [], isLoading } = useQuery({
    queryKey: ['workorders'],
    queryFn: () => fetchApi<WorkOrder[]>('/workorders?page_size=100'),
  })

  const { data: dash } = useQuery({
    queryKey: ['dashboard-maintenance'],
    queryFn: () => fetchApi<{ open_work_orders: number; pm_compliance_pct: number }>('/dashboard/maintenance'),
  })

  return (
    <AppLayout title="Maintenance">
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Maintenance Center
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Open work orders: {dash?.open_work_orders ?? '—'} · PM compliance: {dash?.pm_compliance_pct ?? '—'}%
      </Typography>
      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      <Card>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>WO #</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Asset</TableCell>
              <TableCell>Crew</TableCell>
              <TableCell>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {wos.map((wo) => (
              <TableRow key={wo.id}>
                <TableCell>{wo.work_order_number}</TableCell>
                <TableCell>
                  <Chip label={wo.maintenance_type} size="small" />
                </TableCell>
                <TableCell>{wo.priority}</TableCell>
                <TableCell>{wo.status}</TableCell>
                <TableCell>{wo.asset_code || '—'}</TableCell>
                <TableCell>{wo.assigned_crew || '—'}</TableCell>
                <TableCell>{wo.description || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  )
}
