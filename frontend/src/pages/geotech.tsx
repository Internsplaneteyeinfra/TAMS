import dynamic from 'next/dynamic'

export default dynamic(() => import('@/components/pages/GeotechPage'), { ssr: false })
