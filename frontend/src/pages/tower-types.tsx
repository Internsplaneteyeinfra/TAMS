import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'

import { fetchApi, type Asset } from '@/lib/api'

const GISMap3D = dynamic(() => import('@/components/GISMap3D'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-[#060B17] text-slate-400 text-sm">
      Loading 3D tower map…
    </div>
  ),
})

export default function TowerTypesPage() {
  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ['tower-types-assets'],
    queryFn: () => fetchApi<Asset[]>('/assets?page_size=12000'),
    staleTime: 2 * 60 * 1000,
  })

  const assetCount = useMemo(() => assets.length, [assets])

  return (
    <div className="relative min-h-screen bg-[#060B17] text-slate-100">
      {isLoading && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/80">
          <div className="rounded-md bg-slate-900/95 px-4 py-3 text-sm text-slate-100 shadow-lg">
            Loading 3D asset visualization…
          </div>
        </div>
      )}
      <div className="absolute top-4 left-4 z-20 rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-[11px] text-slate-200 shadow-lg">
        <div className="font-semibold text-white">3D Grid View</div>
        <div className="text-slate-400">Rendering {assetCount.toLocaleString()} assets</div>
      </div>
      <Link
        href="/"
        aria-label="Back to module selection"
        className="absolute top-4 right-4 z-20 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-[11px] font-bold text-slate-200 shadow-lg hover:border-slate-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </Link>
      <div className="absolute inset-0">
        <GISMap3D assets={assets} />
      </div>
    </div>
  )
}
