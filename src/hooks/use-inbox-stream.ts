'use client'

import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'

let socket: Socket | null = null
let socketToken: string | null = null

function getSocket(authToken: string | null): Socket {
  if (socket && socketToken !== authToken) {
    socket.disconnect()
    socket = null
  }
  if (socket) return socket

  socketToken = authToken
  const realtimeUrl =
    process.env.NEXT_PUBLIC_REALTIME_URL ??
    `${window.location.protocol}//${window.location.hostname}:3003`
  socket = io(realtimeUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    auth: { token: authToken || undefined },
  })
  return socket
}

export interface InboxThreadEventPayload {
  threadId: string
  kind: 'created' | 'message' | 'updated'
  messageType: string
  senderName?: string
  preview?: string
}

/**
 * Subscribes to realtime inbox thread events (webhook ingest + teammate
 * replies) and refreshes the inbox queries so new messages appear without a
 * manual refresh. Optional onEvent callback lets the view show a toast or
 * play a notification sound for inbound messages.
 *
 * Mirrors use-publish-stream (same socket, same /api/realtime-token JWT).
 */
export function useInboxStream(
  workspaceId: string | null | undefined,
  onEvent?: (payload: InboxThreadEventPayload) => void
): void {
  const queryClient = useQueryClient()
  const { status } = useSession()
  const [realtimeToken, setRealtimeToken] = useState<string | null>(null)
  // Ref keeps the latest callback without resubscribing the socket per render.
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (status !== 'authenticated') return

    let cancelled = false
    fetch('/api/realtime-token')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { token?: string } | null) => {
        if (!cancelled && data?.token) setRealtimeToken(data.token)
      })
      .catch(() => null)
    return () => {
      cancelled = true
      setRealtimeToken(null)
    }
  }, [status])

  useEffect(() => {
    if (!workspaceId) return
    if (status === 'loading') return

    const s = getSocket(realtimeToken)

    const onConnect = () => {
      s.emit('subscribe', { workspaceId })
    }
    const onThread = (payload: InboxThreadEventPayload) => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] })
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', payload.threadId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      onEventRef.current?.(payload)
    }

    s.on('connect', onConnect)
    s.on('inbox:thread', onThread)

    if (s.connected) {
      s.emit('subscribe', { workspaceId })
    }

    return () => {
      s.off('connect', onConnect)
      s.off('inbox:thread', onThread)
      s.emit('unsubscribe', { workspaceId })
    }
  }, [workspaceId, queryClient, realtimeToken, status])
}
