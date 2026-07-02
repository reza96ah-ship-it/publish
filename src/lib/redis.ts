/**
 * Shared ioredis client for non-queue operations (rate limiting, caching).
 * Lazy-initialized: the connection is opened on first use, not at module load.
 * BullMQ manages its own internal ioredis connection via queue.ts.
 */
import Redis from 'ioredis'

let _client: Redis | null = null

export function getRedisClient(): Redis {
  if (!_client) {
    _client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: true,
    })
    _client.on('error', (err) => {
      // Non-fatal: rate limiting degrades gracefully when Redis is down
      console.error('[redis] client error:', err.message)
    })
  }
  return _client
}
