import React, { useMemo, useState } from 'react'
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
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@/components/mui'
import AppLayout from '@/components/layout/AppLayout'
import {
  createGeotech,
  deleteGeotech,
  fetchGeotechList,
  getGeotechReportUrl,
  updateGeotech,
  type GeotechInvestigation,
  type GeotechPayload,
  type GeotechSoilLayer,
} from '@/lib/geotechApi'
import {
  deleteSiteScore,
  fetchSiteScores,
  type SavedSiteScore,
} from '@/lib/siteScoresApi'

function asFiniteNumber(value: unknown, field: string): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) throw new Error(`soil_layers entry missing valid ${field}`)
  return n
}

/** Parse editor JSON into typed soil layers (required depths validated). */
function parseSoilLayersJson(raw: string): GeotechSoilLayer[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw || '[]')
  } catch {
    throw new Error('Invalid soil layers JSON')
  }
  if (!Array.isArray(parsed)) throw new Error('soil_layers must be a JSON array')

  return parsed.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`soil_layers[${index}] must be an object`)
    }
    const item = row as Record<string, unknown>
    const layer: GeotechSoilLayer = {
      depth_from_m: asFiniteNumber(item.depth_from_m, 'depth_from_m'),
      depth_to_m: asFiniteNumber(item.depth_to_m, 'depth_to_m'),
    }
    const optionalNumberKeys = [
      'gravel_pct',
      'sand_pct',
      'silt_pct',
      'clay_pct',
      'll',
      'pl',
      'pi',
      'mdd',
      'omc',
      'dry_density',
      'fsi',
      'bulk_density',
      'ucs',
      'sg',
      'sbc',
      'cbr',
    ] as const
    for (const key of optionalNumberKeys) {
      if (item[key] === undefined || item[key] === null || item[key] === '') continue
      const n = Number(item[key])
      if (!Number.isFinite(n)) throw new Error(`soil_layers[${index}].${key} must be a number`)
      layer[key] = n
    }
    if (typeof item.soil_class === 'string') layer.soil_class = item.soil_class
    if (typeof item.remarks === 'string') layer.remarks = item.remarks
    return layer
  })
}

const emptyForm = (): GeotechPayload => ({
  site_code: '',
  site_name: '',
  project_name: 'Transmission line',
  client_name: '',
  purpose: 'Construction of Transmission Tower',
  region: '',
  latitude: 23.446103,
  longitude: 69.599508,
  investigation_depth_m: 2,
  groundwater_note: 'Not encountered up to 2.0 m',
  soil_layers: [],
  design_params: {
    foundation_type: '1.0 m × 1.0 m Isolated Stub Foundation',
    df_m: 1.5,
    fos_shear: 2.5,
    fos_uplift: 3.0,
    c_tm2: 1.5,
    phi_deg: 20,
    gamma_tm3: 1.9,
  },
  sbc_by_depth: [
    { depth_m: 0.5, sbc_tm2: 10 },
    { depth_m: 1.0, sbc_tm2: 15 },
    { depth_m: 1.5, sbc_tm2: 20, design: true },
    { depth_m: 2.0, sbc_tm2: 24 },
  ],
  pile_capacities: [
    { diameter_mm: 450, depth_m: 2.0, vertical_t: 8.3, uplift_t: 1.08, lateral_t: 5.6 },
    { diameter_mm: 600, depth_m: 2.0, vertical_t: 14.7, uplift_t: 1.44, lateral_t: 8.9 },
  ],
  cbr_by_depth: [
    { depth_from_m: 0, depth_to_m: 1, soil_type: 'CI', cbr_pct: 4 },
    { depth_from_m: 1, depth_to_m: 2, soil_type: 'SM', cbr_pct: 12 },
  ],
  resistivity: {
    method: 'Wenner (IS 3043)',
    formula: 'ρ = 2π a R',
    adopted_ohm_m: 85,
    target_earth_resistance_ohm: 10,
  },
  recommendations: {
    adopted_sbc_tm2: 20,
    design_depth_m: 1.5,
    governing_cbr_pct: 4,
    recommended_pile: '600 mm × 2.0 m (angle/tension); 450 mm × 2.0 m (suspension)',
  },
  remarks: '',
})

export default function GeotechPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [scoresOpen, setScoresOpen] = useState(false)
  const [selectedScore, setSelectedScore] = useState<SavedSiteScore | null>(null)
  const [editing, setEditing] = useState<GeotechInvestigation | null>(null)
  const [form, setForm] = useState<GeotechPayload>(emptyForm())
  const [layersJson, setLayersJson] = useState('[]')
  const [error, setError] = useState<string | null>(null)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['geotech'],
    queryFn: () => fetchGeotechList(100),
  })

  const {
    data: siteScores = [],
    isLoading: scoresLoading,
    refetch: refetchScores,
  } = useQuery({
    queryKey: ['site-scores'],
    queryFn: () => fetchSiteScores(100),
    enabled: scoresOpen,
  })

  const saveMut = useMutation({
    mutationFn: async () => {
      const soil_layers = parseSoilLayersJson(layersJson)
      const payload: GeotechPayload = { ...form, soil_layers }
      if (editing?.id) return updateGeotech(editing.id, payload)
      return createGeotech(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['geotech'] })
      setOpen(false)
      setEditing(null)
      setError(null)
    },
    onError: (e: Error) => setError(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => deleteGeotech(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geotech'] }),
  })

  const delScoreMut = useMutation({
    mutationFn: (id: string) => deleteSiteScore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-scores'] })
      setSelectedScore(null)
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setLayersJson('[]')
    setError(null)
    setOpen(true)
  }

  const openEdit = (row: GeotechInvestigation) => {
    setEditing(row)
    setForm({
      site_code: row.site_code,
      site_name: row.site_name,
      project_name: row.project_name,
      client_name: row.client_name,
      purpose: row.purpose,
      region: row.region,
      latitude: row.latitude,
      longitude: row.longitude,
      investigation_depth_m: row.investigation_depth_m,
      groundwater_note: row.groundwater_note,
      soil_layers: row.soil_layers,
      design_params: row.design_params,
      sbc_by_depth: row.sbc_by_depth,
      pile_capacities: row.pile_capacities,
      cbr_by_depth: row.cbr_by_depth,
      resistivity: row.resistivity,
      recommendations: row.recommendations,
      remarks: row.remarks,
    })
    setLayersJson(JSON.stringify(row.soil_layers || [], null, 2))
    setError(null)
    setOpen(true)
  }

  const setNum = (key: keyof GeotechPayload, v: string) => {
    const n = Number(v)
    setForm((f) => ({ ...f, [key]: Number.isFinite(n) ? n : f[key] }))
  }

  const recSummary = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        sbc: r.recommendations?.adopted_sbc_tm2,
        cbr: r.recommendations?.governing_cbr_pct,
        rho: r.resistivity?.adopted_ohm_m,
      })),
    [rows]
  )

  return (
    <AppLayout title="Geotech">
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Geotechnical Investigations
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter / edit borehole & soil data, SBC, piles, CBR, resistivity — then generate reports.
            Wired into Tower Suitability when a site is within 5 km of an investigation.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            onClick={() => {
              setScoresOpen(true)
              setSelectedScore(null)
              void refetchScores()
            }}
          >
            Saved site scores
          </Button>
          <Button variant="contained" onClick={openCreate}>
            New investigation
          </Button>
        </Stack>
      </Stack>

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      <Card>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Site code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>SBC</TableCell>
              <TableCell>CBR</TableCell>
              <TableCell>ρ (Ω·m)</TableCell>
              <TableCell>Layers</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => {
              const s = recSummary.find((x) => x.id === r.id)
              return (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Chip label={r.site_code} size="small" color="primary" />
                  </TableCell>
                  <TableCell>{r.site_name}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                  </TableCell>
                  <TableCell>{s?.sbc != null ? `${s.sbc} T/m²` : '—'}</TableCell>
                  <TableCell>{s?.cbr != null ? `${s.cbr}%` : '—'}</TableCell>
                  <TableCell>{s?.rho ?? '—'}</TableCell>
                  <TableCell>{r.soil_layers?.length ?? 0}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" onClick={() => openEdit(r)}>
                        Edit
                      </Button>
                      <Button
                        size="small"
                        component="a"
                        href={getGeotechReportUrl(r.id)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Report
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          if (window.confirm(`Delete ${r.site_code}?`)) delMut.mutate(r.id)
                        }}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              )
            })}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  No investigations yet. Create one or wait for the Nirona seed to load.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? `Edit ${editing.site_code}` : 'New geotech investigation'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && (
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Site code"
                fullWidth
                required
                value={form.site_code}
                onChange={(e) => setForm({ ...form, site_code: e.target.value })}
              />
              <TextField
                label="Site name"
                fullWidth
                required
                value={form.site_name}
                onChange={(e) => setForm({ ...form, site_name: e.target.value })}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Project"
                fullWidth
                value={form.project_name || ''}
                onChange={(e) => setForm({ ...form, project_name: e.target.value })}
              />
              <TextField
                label="Client"
                fullWidth
                value={form.client_name || ''}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              />
            </Stack>
            <TextField
              label="Purpose"
              fullWidth
              value={form.purpose || ''}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            />
            <TextField
              label="Region"
              fullWidth
              value={form.region || ''}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Latitude"
                type="number"
                fullWidth
                value={form.latitude}
                onChange={(e) => setNum('latitude', e.target.value)}
              />
              <TextField
                label="Longitude"
                type="number"
                fullWidth
                value={form.longitude}
                onChange={(e) => setNum('longitude', e.target.value)}
              />
              <TextField
                label="Depth (m)"
                type="number"
                fullWidth
                value={form.investigation_depth_m}
                onChange={(e) => setNum('investigation_depth_m', e.target.value)}
              />
            </Stack>
            <TextField
              label="Groundwater note"
              fullWidth
              value={form.groundwater_note || ''}
              onChange={(e) => setForm({ ...form, groundwater_note: e.target.value })}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Adopted SBC (T/m²)"
                type="number"
                fullWidth
                value={form.recommendations?.adopted_sbc_tm2 ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    recommendations: {
                      ...form.recommendations,
                      adopted_sbc_tm2: Number(e.target.value),
                    },
                  })
                }
              />
              <TextField
                label="Design depth (m)"
                type="number"
                fullWidth
                value={form.recommendations?.design_depth_m ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    recommendations: {
                      ...form.recommendations,
                      design_depth_m: Number(e.target.value),
                    },
                  })
                }
              />
              <TextField
                label="Governing CBR (%)"
                type="number"
                fullWidth
                value={form.recommendations?.governing_cbr_pct ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    recommendations: {
                      ...form.recommendations,
                      governing_cbr_pct: Number(e.target.value),
                    },
                  })
                }
              />
              <TextField
                label="Resistivity (Ω·m)"
                type="number"
                fullWidth
                value={form.resistivity?.adopted_ohm_m ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    resistivity: {
                      ...form.resistivity,
                      adopted_ohm_m: Number(e.target.value),
                    },
                  })
                }
              />
            </Stack>
            <TextField
              label="Soil layers (JSON array)"
              fullWidth
              multiline
              minRows={8}
              value={layersJson}
              onChange={(e) => setLayersJson(e.target.value)}
              helperText="Paste layer objects with gravel/sand/silt/clay, LL/PL/PI, MDD, UCS, SBC, CBR, etc."
            />
            <TextField
              label="Remarks"
              fullWidth
              multiline
              minRows={2}
              value={form.remarks || ''}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={saveMut.isPending || !form.site_code || !form.site_name}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={scoresOpen}
        onClose={() => {
          setScoresOpen(false)
          setSelectedScore(null)
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Saved site scores</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Tower Suitability runs saved to the database. Open a row to see score, factors, and power
            connect summary.
          </Typography>
          {scoresLoading && <LinearProgress sx={{ mb: 2 }} />}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
            <Card sx={{ flex: 1, overflow: 'auto', maxHeight: 480 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Site</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Verdict</TableCell>
                    <TableCell>kV</TableCell>
                    <TableCell>Saved</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {siteScores.map((s) => (
                    <TableRow
                      key={s.id}
                      hover
                      selected={selectedScore?.id === s.id}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setSelectedScore(s)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {s.site_label}
                        </Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight={800}>{s.final_score.toFixed(1)}</Typography>
                        {s.confidence_pct != null && (
                          <Typography variant="caption" color="text.secondary">
                            ~{Math.round(s.confidence_pct)}% conf.
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={s.verdict}
                          color={
                            s.verdict === 'preferred'
                              ? 'success'
                              : s.verdict === 'unsuitable'
                                ? 'error'
                                : 'warning'
                          }
                        />
                      </TableCell>
                      <TableCell>{s.voltage_kv != null ? `${s.voltage_kv}` : '—'}</TableCell>
                      <TableCell>
                        {s.created_at ? new Date(s.created_at).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => {
                            if (window.confirm(`Delete saved score for “${s.site_label}”?`)) {
                              delScoreMut.mutate(s.id)
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!scoresLoading && siteScores.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        No saved scores yet. Run Tower Suitability → Analyze → Save to database.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>

            <Card sx={{ flex: 1, p: 2, minHeight: 280, maxHeight: 480, overflow: 'auto' }}>
              {!selectedScore ? (
                <Typography variant="body2" color="text.secondary">
                  Select a saved score to inspect details.
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  <Typography variant="h6" fontWeight={800}>
                    {selectedScore.site_label}
                  </Typography>
                  {selectedScore.place_label && (
                    <Typography variant="body2" color="primary">
                      {selectedScore.place_label}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {selectedScore.latitude.toFixed(6)}, {selectedScore.longitude.toFixed(6)}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label={`Score ${selectedScore.final_score.toFixed(2)} / 10`} color="primary" />
                    <Chip label={selectedScore.verdict} />
                    {selectedScore.confidence_pct != null && (
                      <Chip label={`~${Math.round(selectedScore.confidence_pct)}% confidence`} />
                    )}
                    {selectedScore.voltage_kv != null && (
                      <Chip label={`${selectedScore.voltage_kv} kV`} />
                    )}
                    {selectedScore.search_radius_km != null && (
                      <Chip label={`Search ${selectedScore.search_radius_km} km`} />
                    )}
                  </Stack>
                  {selectedScore.summary && (
                    <Typography variant="body2">{selectedScore.summary}</Typography>
                  )}
                  {Array.isArray(selectedScore.factors) && selectedScore.factors.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>
                        Factors
                      </Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Factor</TableCell>
                            <TableCell>Value</TableCell>
                            <TableCell align="right">Score</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedScore.factors.map((f, i) => (
                            <TableRow key={f.id || `${f.label}-${i}`}>
                              <TableCell>{f.label || f.id || '—'}</TableCell>
                              <TableCell>{f.rawLabel || '—'}</TableCell>
                              <TableCell align="right">
                                {f.score != null ? f.score.toFixed(1) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  )}
                  {selectedScore.result_payload?.corridorAdvice != null && (
                    <Typography variant="body2" color="text.secondary">
                      Corridor:{' '}
                      {JSON.stringify(selectedScore.result_payload.corridorAdvice)}
                    </Typography>
                  )}
                  {selectedScore.notes && (
                    <Typography variant="caption" color="text.secondary">
                      {selectedScore.notes}
                    </Typography>
                  )}
                </Stack>
              )}
            </Card>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setScoresOpen(false)
              setSelectedScore(null)
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  )
}
