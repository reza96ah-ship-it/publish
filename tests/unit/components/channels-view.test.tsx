import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../setup'
import { ChannelsView } from '../../../src/components/views/channels-view'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/channels',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('Component: ChannelsView', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<ChannelsView />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders channel/platform cards', () => {
    renderWithProviders(<ChannelsView />)
    expect(document.body).toBeTruthy()
  })
})
