'use client'

import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Instagram, Loader2, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import { relativeTime, toPersianDigits } from '@/lib/jalali'
import type { ZernioInboxConversation, ZernioInboxMessage, ZernioInboxPage } from '@/lib/zernio'

type ConversationPage = ZernioInboxPage<ZernioInboxConversation> & {
  connected: boolean
  accountsFailed: number
}

function timeLabel(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : relativeTime(date)
}

export function ZernioInstagramInbox() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const conversationsQuery = useInfiniteQuery({
    queryKey: ['zernio-instagram-inbox'],
    queryFn: ({ pageParam }) => api.get<ConversationPage>(
      `/api/inbox/zernio${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
    ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchInterval: 60_000,
  })
  const conversations = useMemo(
    () => conversationsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [conversationsQuery.data],
  )

  useEffect(() => {
    if (conversations.length === 0) {
      setSelectedId(null)
      setSelectedAccountId(null)
      return
    }
    if (!conversations.some((row) => row.id === selectedId && row.accountId === selectedAccountId)) {
      setSelectedId(conversations[0].id)
      setSelectedAccountId(conversations[0].accountId)
    }
  }, [conversations, selectedId, selectedAccountId])

  const messagesQuery = useInfiniteQuery({
    queryKey: ['zernio-instagram-messages', selectedAccountId, selectedId],
    queryFn: ({ pageParam }) => api.get<ZernioInboxPage<ZernioInboxMessage>>(
      `/api/inbox/zernio/${encodeURIComponent(selectedId ?? '')}/messages?accountId=${encodeURIComponent(selectedAccountId ?? '')}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
    ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(selectedId && selectedAccountId),
    refetchInterval: 60_000,
  })
  const messages = useMemo(
    () => (messagesQuery.data?.pages.flatMap((page) => page.data) ?? [])
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')),
    [messagesQuery.data],
  )
  const selected = conversations.find((row) => row.id === selectedId && row.accountId === selectedAccountId)

  if (!conversationsQuery.isError && !conversationsQuery.data?.pages[0]?.connected) return null

  return (
    <section className="n-card overflow-hidden" dir="rtl" aria-label="پیام‌های اینستاگرام متصل">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Instagram className="size-5 text-accent" aria-hidden="true" />
          <h2 className="font-semibold text-ink-primary">پیام‌های اینستاگرام متصل</h2>
          <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs text-ink-secondary">فقط نمایش</span>
        </div>
        <button type="button" onClick={() => {
          void conversationsQuery.refetch()
          if (selectedId && selectedAccountId) void messagesQuery.refetch()
        }}
          className="n-focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-secondary hover:text-accent"
          aria-label="به‌روزرسانی پیام‌های اینستاگرام">
          <RefreshCw className="size-3.5" aria-hidden="true" /> به‌روزرسانی
        </button>
      </div>
      {conversationsQuery.isError ? (
        <p className="p-4 text-sm text-danger">دریافت پیام‌ها از Zernio ممکن نشد. دوباره تلاش کنید.</p>
      ) : (
        <>
          {conversationsQuery.data?.pages.some((page) => page.accountsFailed > 0) && (
            <p className="border-b border-border px-4 py-2 text-xs text-warning">برخی حساب‌ها در Zernio پاسخ ندادند؛ این فهرست ممکن است ناقص باشد.</p>
          )}
          <div className="grid min-h-64 grid-cols-1 md:grid-cols-[minmax(14rem,1fr)_minmax(0,2fr)]">
            <div className="max-h-96 overflow-y-auto border-b border-border md:border-b-0 md:border-l">
              {conversations.length === 0 ? (
                <p className="p-4 text-sm text-ink-secondary">هنوز گفت‌وگویی از Zernio دریافت نشده است.</p>
              ) : conversations.map((row) => (
                <button key={`${row.accountId}:${row.id}`} type="button"
                  onClick={() => { setSelectedId(row.id); setSelectedAccountId(row.accountId) }}
                  className={`n-focus-ring w-full border-b border-border px-4 py-3 text-right hover:bg-surface-hover ${selectedId === row.id && selectedAccountId === row.accountId ? 'bg-surface-subtle' : ''}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink-primary">{row.participantName}</span>
                    <span className="shrink-0 text-xs text-ink-tertiary">{timeLabel(row.updatedTime)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-tertiary" dir="auto">@{row.accountUsername}</span>
                  <span className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-ink-secondary" dir="auto">{row.lastMessage || 'پیام بدون متن'}</span>
                    {row.unreadCount !== null && row.unreadCount > 0 && (
                      <span className="rounded-full bg-accent px-1.5 py-0.5 text-xs text-white">{toPersianDigits(row.unreadCount)}</span>
                    )}
                  </span>
                </button>
              ))}
              {conversationsQuery.hasNextPage && (
                <button type="button" onClick={() => void conversationsQuery.fetchNextPage()}
                  disabled={conversationsQuery.isFetchingNextPage}
                  className="n-focus-ring w-full p-3 text-xs text-accent disabled:opacity-50">گفت‌وگوهای بیشتر</button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto p-4">
              {selected ? (
                <>
                  <div className="mb-3 border-b border-border pb-2 text-sm font-semibold text-ink-primary">{selected.participantName}</div>
                  {messagesQuery.hasNextPage && (
                    <button type="button" onClick={() => void messagesQuery.fetchNextPage()}
                      disabled={messagesQuery.isFetchingNextPage}
                      className="n-focus-ring mb-3 w-full text-center text-xs text-accent disabled:opacity-50">پیام‌های قدیمی‌تر</button>
                  )}
                  {messagesQuery.isPending ? (
                    <div className="flex items-center gap-2 text-sm text-ink-secondary"><Loader2 className="size-4 animate-spin" /> در حال دریافت پیام‌ها…</div>
                  ) : messagesQuery.isError ? (
                    <p className="text-sm text-danger">دریافت متن گفت‌وگو ممکن نشد.</p>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-ink-secondary">پیامی در این گفت‌وگو در دسترس نیست.</p>
                  ) : (
                    <div className="space-y-2">
                      {messages.map((message) => (
                        <div key={message.id} className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${message.direction === 'outgoing' ? 'mr-auto bg-accent-soft' : 'ml-auto bg-surface-hover'}`}>
                          <div className="whitespace-pre-wrap break-words text-ink-primary" dir="auto">{message.message || (message.attachmentCount > 0 ? 'پیوست' : 'پیام بدون متن')}</div>
                          {message.attachmentCount > 0 && <p className="mt-1 text-xs text-ink-secondary">{toPersianDigits(message.attachmentCount)} پیوست</p>}
                          <p className="mt-1 text-[11px] text-ink-tertiary">{message.senderName} · {timeLabel(message.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : <p className="text-sm text-ink-secondary">یک گفت‌وگو را انتخاب کنید.</p>}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
