// Quick end-to-end test for the realtime relay.
// Spawns a socket.io client, subscribes to a workspace room, then triggers
// a POST /emit and verifies the broadcast arrives. Exits 0 on success.

import { io as ioClient } from 'socket.io-client'

const URL = 'http://127.0.0.1:3003'
const WORKSPACE_ID = 'ws_e2e_test'
const JOB_ID = 'job_e2e_001'

const socket = ioClient(URL, {
  transports: ['websocket', 'polling'],
  timeout: 5000,
})

const received: { event: string; payload: unknown }[] = []

const done = new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => {
    reject(new Error('timeout waiting for broadcast'))
  }, 8000)

  socket.on('connect', () => {
    console.log(`[client] connected id=${socket.id}`)
    socket.emit('subscribe', { workspaceId: WORKSPACE_ID })
  })

  socket.on('subscribed', (data: { workspaceId: string; room: string }) => {
    console.log(`[client] subscribed ack:`, data)
    // Now ask the relay to broadcast by POSTing /emit.
    fetch(`${URL}/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
        event: 'job:status',
        payload: {
          jobId: JOB_ID,
          status: 'success',
          progress: 100,
          processLabel: 'Published to Instagram',
          error: null,
          platform: 'instagram',
          externalId: 'ig_1789_xxx',
        },
      }),
    })
      .then((r) => r.json())
      .then((j) => console.log('[client] /emit response:', j))
      .catch(reject)
  })

  socket.on('job:status', (payload: unknown) => {
    console.log('[client] received job:status:', JSON.stringify(payload))
    received.push({ event: 'job:status', payload })
    clearTimeout(timer)
    resolve()
  })

  socket.on('connect_error', (err: Error) => reject(err))
})

try {
  await done
  // Validate the payload shape
  const p = received[0]?.payload as Record<string, unknown>
  if (
    received.length === 1 &&
    p?.jobId === JOB_ID &&
    p?.status === 'success' &&
    p?.platform === 'instagram' &&
    p?.externalId === 'ig_1789_xxx'
  ) {
    console.log('[client] E2E PASS — broadcast received with correct payload')
    socket.disconnect()
    process.exit(0)
  } else {
    console.error('[client] E2E FAIL — unexpected payload:', received)
    socket.disconnect()
    process.exit(1)
  }
} catch (err) {
  console.error('[client] E2E FAIL:', err)
  socket.disconnect()
  process.exit(1)
}
