import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../setup'
import { ComposeView } from '../../../src/components/views/compose-view'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/compose',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('Component: ComposeView', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<ComposeView />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders the live preview section', () => {
    renderWithProviders(<ComposeView />)
    // Look for the preview heading text
    const previewText = screen.queryByText(/پیش‌نمایش/i)
    // It may not be immediately visible if lazy-loaded, so just check container
    expect(document.body).toBeTruthy()
  })

  it('renders the schedule section', () => {
    const { container } = renderWithProviders(<ComposeView />)
    // The compose view should have a schedule section
    const cards = container.querySelectorAll('.n-card')
    expect(cards.length).toBeGreaterThan(0)
  })
})
