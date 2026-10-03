import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../setup'
import { PublicationRecovery } from '@/components/views/publication-recovery'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { patch: vi.fn(), post: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const job = {
  id: 'job1', status: 'action', error: 'Outcome unknown', publicationId: 'pub1',
  reconciliationStatus: 'still_unknown', publicationError: null, canResolve: true,
}

beforeEach(() => vi.clearAllMocks())

describe('PublicationRecovery', () => {
  it('never offers blind retry for an unknown outcome', () => {
    renderWithProviders(<PublicationRecovery job={job} />)
    expect(screen.getByText(/تلاش مجدد تا بررسی دستی مسدود است/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'تلاش مجدد انتشار' })).not.toBeInTheDocument()
  })

  it('requires checked evidence before resolving an unknown outcome', async () => {
    vi.mocked(api.post).mockResolvedValue({ ok: true })
    renderWithProviders(<PublicationRecovery job={job} />)
    fireEvent.click(screen.getByRole('button', { name: 'بررسی و حل دستی' }))
    const submit = screen.getByRole('button', { name: 'ثبت نتیجه بررسی' })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText('شناسه پست اینستاگرام'), { target: { value: 'ig123' } })
    fireEvent.change(screen.getByLabelText(/دلیل و شواهد بررسی/), { target: { value: 'Verified exact post externally' } })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/publications/pub1/resolve', {
      action: 'mark_published', providerPostId: 'ig123', reason: 'Verified exact post externally',
    }))
  })

  it('offers ordinary retry only after a definite failure', async () => {
    vi.mocked(api.patch).mockResolvedValue({ ok: true })
    renderWithProviders(<PublicationRecovery job={{ ...job, status: 'failed', reconciliationStatus: 'confirmed_failure' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'تلاش مجدد انتشار' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/publish-jobs/job1', { action: 'retry' }))
  })
})
