import { describe, it, expect } from 'vitest'
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../setup'
import { DashboardView } from '../../../src/components/views/dashboard-view'

describe('Component: DashboardView', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<DashboardView />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders the operational summary section', () => {
    renderWithProviders(<DashboardView />)
    // The dashboard should have grid layout
    const grid = document.querySelector('.grid')
    expect(grid).toBeTruthy()
  })

  it('renders multiple panels', () => {
    const { container } = renderWithProviders(<DashboardView />)
    // Should have at least 3 child sections (summary, pulse+action, metrics, campaigns+platforms)
    const sections = container.querySelectorAll('.flex.flex-col > div')
    expect(sections.length).toBeGreaterThanOrEqual(3)
  })
})
