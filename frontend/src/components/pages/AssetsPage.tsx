import React, { useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@/components/mui'
import AppLayout from '@/components/layout/AppLayout'
import { fetchApi, createAsset, type Asset } from '@/lib/api'

const criticalityColor: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  Critical: 'error',
  High: 'warning',
  Medium: 'info',
  Low: 'default',
}

export default function AssetsPage() {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', asset_type: 'substation', latitude: '', longitude: '' })
  const queryClient = useQueryClient()

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', search],
    queryFn: () => fetchApi<Asset[]>(`/assets?search=${encodeURIComponent(search)}&page_size=200`),
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => createAsset(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      setOpen(false)
    },
  })

  const filtered = search
    ? assets.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : assets

  return (
    <AppLayout title="Asset Registry">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Asset Registry
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          New Asset
        </Button>
      </Box>

      <TextField
        size="small"
        placeholder="Search assets..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2, minWidth: 320 }}
      />
      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      <Card>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code / Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Criticality</TableCell>
              <TableCell>Health</TableCell>
              <TableCell>Location</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((a) => (
              <TableRow key={a.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {(a as Asset & { asset_code?: string }).asset_code || a.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {a.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={a.asset_type} size="small" />
                </TableCell>
                <TableCell>{(a as Asset & { status?: string }).status || a.status}</TableCell>
                <TableCell>
                  <Chip
                    label={(a as Asset & { criticality?: string }).criticality || 'Medium'}
                    size="small"
                    color={criticalityColor[(a as Asset & { criticality?: string }).criticality || ''] || 'default'}
                  />
                </TableCell>
                <TableCell>{a.health_score || '—'}</TableCell>
                <TableCell>
                  {a.latitude?.toFixed(4)}, {a.longitude?.toFixed(4)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Asset</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Latitude"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              />
              <TextField
                fullWidth
                label="Longitude"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() =>
              createMutation.mutate({
                name: form.name,
                asset_type: form.asset_type,
                latitude: parseFloat(form.latitude) || 0,
                longitude: parseFloat(form.longitude) || 0,
              })
            }
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  )
}
