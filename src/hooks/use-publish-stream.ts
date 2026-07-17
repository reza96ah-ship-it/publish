'use client'

import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'

let socket: Socket | null = null
let socketToken: string | null = null

function getSocket(authToken: string | null): Socket {
  // Reconnect with a new token if the token changed (e.g. after re-login)
  if (socket && socketToken !== authToken) {
    socket.disconnect()
    socket = null
  }
  if (socket) return socket

  socketToken = authToken
  // Realtime service runs on its own port (3003), not behind the app server.
  // The old '/?XTransformPort=3003' form only worked behind the Z.ai preview
  // proxy — in normal deployments it hit :3000 and the socket always failed.
  const realtimeUrl =
    process.env.NEXT_PUBLIC_REALTIME_URL ??
    window.location.origin
  socket = io(realtimeUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    auth: {
      token: authToken || undefined,
    },
  })
  return socket
}

interface JobStatusPayload {
  jobId: string
  status: string
  progress: number
  processLabel: string
  error: string | null
  platform: string
  externalId: string | null
}

/**
 * Subscribes to realtime job status updates from the publish worker.
 *
 * BUG-02 fix: NextAuth v4 sessions are JWE-encrypted — (session as any)?.token
 * is never a verifiable JWT on the client. We now fetch a short-lived HS256 JWT
 * from /api/realtime-token (server-side, has session access) and pass that to
 * the socket.io handshake instead.
 */
export function usePublishStream(workspaceId: string | null | undefined): void {
  const queryClient = useQueryClient()
  const { status } = useSession()
  const [realtimeToken, setRealtimeToken] = useState<string | null>(null)

  // Fetch a verifiable JWT whenever the session becomes available.
  // Token is cleared in the cleanup (not synchronously in the effect body)
  // to satisfy react-hooks/set-state-in-effect: the cleanup runs when status
  // changes away from 'authenticated', which is the correct clear point.
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
    // Don't connect while authenticated but token not yet fetched — the server
    // rejects null-token connections in production, causing an infinite reconnect loop.
    if (status === 'authenticated' && realtimeToken === null) return

    const s = getSocket(realtimeToken)

    const onConnect = () => {
      s.emit('subscribe', { workspaceId })
    }
    const onStatus = (_payload: JobStatusPayload) => {
      queryClient.invalidateQueries({ queryKey: ['publish-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-pulse'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      if (
        _payload.status === 'success' ||
        _payload.status === 'failed' ||
        _payload.status === 'action'
      ) {
        queryClient.invalidateQueries({ queryKey: ['content'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] })
      }
    }

    s.on('connect', onConnect)
    s.on('job:status', onStatus)
    s.on('job:progress', onStatus)

    if (s.connected) {
      s.emit('subscribe', { workspaceId })
    }

    return () => {
      s.off('connect', onConnect)
      s.off('job:status', onStatus)
      s.off('job:progress', onStatus)
      s.emit('unsubscribe', { workspaceId })
    }
  }, [workspaceId, queryClient, realtimeToken, status])
}
