'use client'

import { useEffect } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'

let socket: Socket | null = null

function getSocket(): Socket {
  if (socket) return socket
  // Connect via the Caddy gateway with XTransformPort for the realtime service
  socket = io('/?XTransformPort=3003', {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
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
 * @param workspaceId - The active workspace ID (null = not connected)
 */
export function usePublishStream(workspaceId: string | null | undefined): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!workspaceId) return

    const s = getSocket()

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
  }, [workspaceId, queryClient])
}
