import Head from 'next/head'
import dynamic from 'next/dynamic'
import { EARTH_DAY_URL } from '@/components/towerSuitability/earthGlobePreload'

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
  return (
    <>
      <Head>
        <link rel="preload" as="image" href={EARTH_DAY_URL} />
      </Head>
      <TowerSuitabilityWorkspace />
    </>
  )
}
