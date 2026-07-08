import dynamic from 'next/dynamic'

export default dynamic(() => import('@/components/pages/AnalyticsPage'), { ssr: false })
