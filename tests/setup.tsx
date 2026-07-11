import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import type { ReactElement } from 'react'

afterEach(() => cleanup())

/**
 * Render with React Query + NextAuth session providers (for component tests).
 * Disables retries so tests don't hang on failed queries. session={null}
 * renders components in the unauthenticated state — hooks like useSession
 * (used by useInboxStream / usePublishStream) need the provider to exist.
 */
export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  })
  return render(
    <SessionProvider session={null} refetchOnWindowFocus={false}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </SessionProvider>
  )
}
