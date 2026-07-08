import dynamic from 'next/dynamic'

export default dynamic(() => import('@/components/pages/MaintenancePage'), { ssr: false })
