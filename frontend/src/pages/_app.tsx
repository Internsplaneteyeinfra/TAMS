import type { AppProps } from 'next/app'
import Head from 'next/head'
import { QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'react-redux'

import queryClient from '@/lib/queryClient'
import store from '@/lib/store'
import '@/styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <Head>
          <link rel="icon" href="/favicon.png?v=2" type="image/png" />
          <link rel="apple-touch-icon" href="/favicon.png?v=2" />
        </Head>
        <Component {...pageProps} />
      </Provider>
    </QueryClientProvider>
  )
}
