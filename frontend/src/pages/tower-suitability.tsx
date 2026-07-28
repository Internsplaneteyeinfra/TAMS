import dynamic from 'next/dynamic'

const TowerSuitabilityWorkspace = dynamic(
  () => import('@/components/towerSuitability/TowerSuitabilityWorkspace'),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-[#060B17] text-slate-400 text-sm">
        Loading tower site suitability…
      </div>
    ),
  }
)

export default function TowerSuitabilityPage() {
  return <TowerSuitabilityWorkspace />
}
