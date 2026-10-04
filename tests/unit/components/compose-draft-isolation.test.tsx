import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../setup'
import { ComposeView } from '@/components/views/compose-view'

const activeSession = vi.hoisted(() => ({
  userId: 'user-b',
  workspaceId: 'workspace-b',
}))

vi.mock('next-auth/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-auth/react')>()),
  useSession: () => ({
    data: { user: { id: activeSession.userId }, activeWorkspaceId: activeSession.workspaceId },
    status: 'authenticated',
  }),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/compose',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

let serverDraft: unknown = null
const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const payload = url.includes('/api/compose-draft')
    ? init?.method === 'POST'
      ? { id: 'draft-1', version: 3 }
      : { draft: serverDraft }
    : url.includes('/api/workspace')
      ? {}
      : { data: [] }
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

beforeEach(() => {
  localStorage.clear()
  mockFetch.mockClear()
  vi.stubGlobal('fetch', mockFetch)
  activeSession.userId = 'user-b'
  activeSession.workspaceId = 'workspace-b'
  serverDraft = null
})

describe('composer browser draft isolation', () => {
  it('restores only the active user and workspace draft, not a legacy shared draft', async () => {
    localStorage.setItem(
      'nashrino_unsaved_draft',
      JSON.stringify({ content: { title: 'Other customer secret' } })
    )
    localStorage.setItem(
      'nashrino_unsaved_draft:workspace-b:user-b',
      JSON.stringify({ content: { title: 'My draft' } })
    )

    renderWithProviders(<ComposeView />)

    expect(await screen.findByDisplayValue('My draft')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Other customer secret')).not.toBeInTheDocument()
  })

  it('does not restore another workspace draft for the same user', async () => {
    localStorage.setItem(
      'nashrino_unsaved_draft:workspace-a:user-b',
      JSON.stringify({ content: { title: 'Workspace A draft' } })
    )

    renderWithProviders(<ComposeView />)

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/compose-draft'))
    expect(screen.queryByDisplayValue('Workspace A draft')).not.toBeInTheDocument()
    expect(localStorage.getItem('nashrino_unsaved_draft:workspace-a:user-b')).not.toBeNull()
  })

  it('uses the latest server version after the user explicitly chooses local changes', async () => {
    localStorage.setItem(
      'nashrino_unsaved_draft:workspace-b:user-b',
      JSON.stringify({
        content: { title: 'Local changes' },
        version: 1,
      })
    )
    serverDraft = { content: { title: 'Server changes' }, version: 2 }

    renderWithProviders(<ComposeView />)
    const restoreButton = await screen.findByRole('button', { name: 'بازیابی تغییرات محلی' })
    vi.useFakeTimers()
    try {
      fireEvent.click(restoreButton)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })
      const post = mockFetch.mock.calls.find(
        ([input, init]) => String(input).includes('/api/compose-draft') && init?.method === 'POST'
      )
      expect(post).toBeDefined()
      expect(JSON.parse(String(post?.[1]?.body)).version).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers a choice when only the scheduled time differs', async () => {
    localStorage.setItem(
      'nashrino_unsaved_draft:workspace-b:user-b',
      JSON.stringify({
        content: { title: 'Same title', scheduleMode: 'schedule' },
        scheduledAt: '2026-11-01T10:00:00.000Z',
        version: 1,
      })
    )
    serverDraft = {
      content: { title: 'Same title', scheduleMode: 'schedule' },
      scheduledAt: '2026-11-02T10:00:00.000Z',
      version: 2,
    }

    renderWithProviders(<ComposeView />)

    expect(await screen.findByRole('button', { name: 'بازیابی تغییرات محلی' })).toBeInTheDocument()
    expect(
      mockFetch.mock.calls.some(
        ([input, init]) => String(input).includes('/api/compose-draft') && init?.method === 'POST'
      )
    ).toBe(false)
  })

  it('restores a note-only draft instead of discarding it as empty', async () => {
    serverDraft = { content: { note: 'Planning note' }, version: 1 }

    renderWithProviders(<ComposeView />)

    expect(await screen.findByDisplayValue('Planning note')).toBeInTheDocument()
  })
})
