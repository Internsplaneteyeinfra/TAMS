import React, { useRef, useState } from 'react'
import { Database, FileUp, Loader2, MapPinned, RefreshCw } from 'lucide-react'

import {
  importStateKmlPack,
  importTowerGroundKml,
  type StateKmlImportResult,
  type TowerGroundImportResult,
} from '@/lib/api'

interface TowerImportButtonProps {
  onCheckTowers?: (placeId?: string) => void
}

const STATE_PACKS = [
  { id: 'andhra', label: 'AP', state: 'Andhra Pradesh', placeId: 'andhra-pradesh' },
  { id: 'arunachal', label: 'AR', state: 'Arunachal Pradesh', placeId: 'arunachal-pradesh' },
  { id: 'assam', label: 'AS', state: 'Assam', placeId: 'assam' },
  { id: 'bihar', label: 'BR', state: 'Bihar', placeId: 'bihar' },
  { id: 'chhattisgarh', label: 'CG', state: 'Chhattisgarh', placeId: 'chhattisgarh' },
  { id: 'delhi', label: 'DL', state: 'Delhi', placeId: 'delhi' },
  { id: 'goa', label: 'GA', state: 'Goa', placeId: 'goa' },
  { id: 'haryana', label: 'HR', state: 'Haryana', placeId: 'haryana' },
  { id: 'himachal', label: 'HP', state: 'Himachal Pradesh', placeId: 'himachal-pradesh' },
  { id: 'jharkhand', label: 'JH', state: 'Jharkhand', placeId: 'jharkhand' },
  { id: 'karnataka', label: 'KA', state: 'Karnataka', placeId: 'karnataka' },
  { id: 'kerala', label: 'KL', state: 'Kerala', placeId: 'kerala' },
  { id: 'madhya', label: 'MP', state: 'Madhya Pradesh', placeId: 'madhya-pradesh' },
  { id: 'maharashtra', label: 'MH', state: 'Maharashtra', placeId: 'maharashtra' },
  { id: 'manipur', label: 'MN', state: 'Manipur', placeId: 'manipur' },
  { id: 'meghalaya', label: 'ML', state: 'Meghalaya', placeId: 'meghalaya' },
  { id: 'mizoram', label: 'MZ', state: 'Mizoram', placeId: 'mizoram' },
  { id: 'nagaland', label: 'NL', state: 'Nagaland', placeId: 'nagaland' },
  { id: 'odisha', label: 'OD', state: 'Odisha', placeId: 'odisha' },
  { id: 'punjab', label: 'PB', state: 'Punjab', placeId: 'punjab' },
  { id: 'rajasthan', label: 'RJ', state: 'Rajasthan', placeId: 'rajasthan' },
  { id: 'sikkim', label: 'SK', state: 'Sikkim', placeId: 'sikkim' },
  { id: 'tamilnadu', label: 'TN', state: 'Tamil Nadu', placeId: 'tamil-nadu' },
  { id: 'telangana', label: 'TS', state: 'Telangana', placeId: 'telangana' },
  { id: 'tripura', label: 'TR', state: 'Tripura', placeId: 'tripura' },
  { id: 'uttarpradesh', label: 'UP', state: 'Uttar Pradesh', placeId: 'uttar-pradesh' },
  { id: 'uttarakhand', label: 'UK', state: 'Uttarakhand', placeId: 'uttarakhand' },
  { id: 'westbengal', label: 'WB', state: 'West Bengal', placeId: 'west-bengal' },
] as const

type ImportMode = 'file' | (typeof STATE_PACKS)[number]['id'] | 'all'

export default function TowerImportButton({ onCheckTowers }: TowerImportButtonProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<ImportMode | null>(null)
  const [fileResult, setFileResult] = useState<TowerGroundImportResult | null>(null)
  const [stateResult, setStateResult] = useState<StateKmlImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastPlaceId, setLastPlaceId] = useState('delhi')

  const runStateImport = async (packId: (typeof STATE_PACKS)[number]['id'] | 'all') => {
    setBusy(true)
    setError(null)
    setFileResult(null)
    setStateResult(null)
    setMode(packId)
    try {
      if (packId === 'all') {
        let inserted = 0
        let sourceTotal = 0
        let towers = 0
        let lines = 0
        let substations = 0
        for (const pack of STATE_PACKS) {
          const next = await importStateKmlPack(pack.state, true)
          inserted += next.inserted
          sourceTotal += next.source_total
          towers += next.towers
          lines += next.lines
          substations += next.substations
        }
        setStateResult({
          state: 'HP+UK+NCR packs',
          inserted,
          source_total: sourceTotal,
          towers,
          lines,
          substations,
          skipped: Math.max(sourceTotal - inserted, 0),
        })
        setLastPlaceId('himachal-pradesh')
      } else {
        const pack = STATE_PACKS.find((p) => p.id === packId)!
        const next = await importStateKmlPack(pack.state, true)
        setStateResult(next)
        setLastPlaceId(pack.placeId)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'State KML import failed')
    } finally {
      setBusy(false)
    }
  }

  const onPickFile = async (file: File) => {
    setBusy(true)
    setError(null)
    setFileResult(null)
    setStateResult(null)
    setMode('file')
    try {
      const next = await importTowerGroundKml(file)
      setFileResult(next)
      setLastPlaceId('gujarat')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tower import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="hidden lg:flex items-center gap-2 shrink-0 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-2 py-1">
      <div className="flex items-center gap-1">
        {STATE_PACKS.map((pack) => (
          <button
            key={pack.id}
            type="button"
            onClick={() => void runStateImport(pack.id)}
            disabled={busy}
            className="inline-flex items-center gap-1 h-8 px-2 rounded-lg bg-amber-500 text-[10px] font-black text-slate-950 hover:bg-amber-400 disabled:opacity-60"
            title={`Import ${pack.state} KML pack into DB`}
          >
            {busy && mode === pack.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Database className="w-3.5 h-3.5" />
            )}
            {pack.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1 h-8 px-2 rounded-lg bg-cyan-500 text-[10px] font-black text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
          title="Upload a single tower-ground .kml into database"
        >
          {busy && mode === 'file' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileUp className="w-3.5 h-3.5" />
          )}
          Upload
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".kml,application/vnd.google-earth.kml+xml,text/xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onPickFile(file)
          e.target.value = ''
        }}
      />

      <div className="min-w-0 max-w-[280px]">
        <div className="flex items-center gap-1 text-[10px] font-bold text-cyan-100">
          <Database className="w-3 h-3" />
          State KML to DB
        </div>
        {busy ? (
          <p className="text-[10px] text-slate-300 truncate">Import running ({mode})…</p>
        ) : error ? (
          <p className="text-[10px] text-red-300 truncate">{error}</p>
        ) : stateResult ? (
          <p className="text-[10px] text-slate-300 truncate">
            {stateResult.state}: +{stateResult.inserted.toLocaleString()} /{' '}
            {stateResult.source_total.toLocaleString()}
          </p>
        ) : fileResult ? (
          <p className="text-[10px] text-slate-300 truncate">
            Inserted {fileResult.inserted.toLocaleString()} / {fileResult.parsed.toLocaleString()} towers
          </p>
        ) : (
          <p className="text-[10px] text-slate-400 truncate">DL · HR · PB · RJ packs, then Check.</p>
        )}
      </div>

      {(stateResult || fileResult) && (
        <button
          type="button"
          onClick={() => onCheckTowers?.(lastPlaceId)}
          className="inline-flex items-center gap-1 h-8 px-2 rounded-lg border border-white/10 bg-slate-950/60 text-[10px] font-bold text-slate-200 hover:border-cyan-500/35 hover:text-cyan-100"
          title={`Refresh ${lastPlaceId} and check imported towers`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Check
          <MapPinned className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
