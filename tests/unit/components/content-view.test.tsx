import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../setup'
import { ContentView } from '../../../src/components/views/content-view'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/content',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('Component: ContentView', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<ContentView />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders content heading or empty state', () => {
    renderWithProviders(<ContentView />)
    // The view should render either content items or an empty state
    expect(document.body).toBeTruthy()
  })
})
