import dynamic from 'next/dynamic'

const TowerSuitabilityWorkspace = dynamic(
  () => import('@/components/towerSuitability/TowerSuitabilityWorkspace'),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F3F7FA] text-[#526579] text-sm">
        Loading tower site suitability…
      </div>
    ),
  }
)

export default function TowerSuitabilityPage() {
  return <TowerSuitabilityWorkspace />
}
