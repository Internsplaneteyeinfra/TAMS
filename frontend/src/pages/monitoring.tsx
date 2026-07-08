import dynamic from 'next/dynamic'

export default dynamic(() => import('@/components/pages/MonitoringPage'), { ssr: false })
