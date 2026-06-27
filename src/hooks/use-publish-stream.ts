'use client'

import { useEffect } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'

let socket: Socket | null = null

function getSocket(authToken?: string | null): Socket {
  if (socket) return socket
  // Connect via the Caddy gateway with XTransformPort for the realtime service
  // P7.1: pass NextAuth session token for JWT handshake auth
  socket = io('/?XTransformPort=3003', {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    auth: {
      token: authToken || undefined,  // undefined = dev bypass (no token)
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
 * On any job status change, invalidates the relevant queries so the
 * Publishing Pulse, dashboard summary, and content library refresh.
 *
 * P7.1: passes NextAuth session token for JWT auth on socket.io connection.
 * In dev (no session), connects without token (realtime dev bypass).
 *
 * @param workspaceId - The active workspace ID (null = not connected)
 */
export function usePublishStream(workspaceId: string | null | undefined): void {
  const queryClient = useQueryClient()
  const { data: session } = useSession()

  useEffect(() => {
    if (!workspaceId) return

    // Get the NextAuth session token (JWT) for socket.io auth
    // next-auth stores it in a cookie; we can get it via the session provider
    const authToken = (session as any)?.token || null
    const s = getSocket(authToken)

    const onConnect = () => {
      s.emit('subscribe', { workspaceId })
    }
    const onStatus = (_payload: JobStatusPayload) => {
      // Invalidate all job-related queries so the UI reflects the new state
      queryClient.invalidateQueries({ queryKey: ['publish-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-pulse'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      // If the job succeeded or failed, also refresh content + metrics
      if (_payload.status === 'success' || _payload.status === 'failed' || _payload.status === 'action') {
        queryClient.invalidateQueries({ queryKey: ['content'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] })
      }
    }

    s.on('connect', onConnect)
    s.on('job:status', onStatus)
    s.on('job:progress', onStatus)

    // If already connected, subscribe immediately
    if (s.connected) {
      s.emit('subscribe', { workspaceId })
    }

    return () => {
      s.off('connect', onConnect)
      s.off('job:status', onStatus)
      s.off('job:progress', onStatus)
      s.emit('unsubscribe', { workspaceId })
    }
  }, [workspaceId, queryClient, session])
}
