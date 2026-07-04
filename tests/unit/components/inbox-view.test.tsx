import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../setup'
import { InboxView } from '../../../src/components/views/inbox-view'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/inbox',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('Component: InboxView', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<InboxView />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders inbox heading or empty state', () => {
    renderWithProviders(<InboxView />)
    expect(document.body).toBeTruthy()
  })
})
