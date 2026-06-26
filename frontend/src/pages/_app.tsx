import type { AppProps } from 'next/app'
import { QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'react-redux'

import queryClient from '@/lib/queryClient'
import store from '@/lib/store'
import '@/styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <Component {...pageProps} />
      </Provider>
    </QueryClientProvider>
  )
}
