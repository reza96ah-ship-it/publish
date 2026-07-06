# Capacity and Deployment Sizing Guide — Issue #157

## Supported deployment sizes

### Small (1–10 workspaces, 100 publications/day)
| Service | Replicas | Memory | CPU |
|---------|----------|--------|-----|
| App | 1 | 512MB | 0.5 |
| Worker | 1 | 256MB | 0.25 |
| Realtime | 1 | 128MB | 0.1 |
| PostgreSQL | 1 | 512MB | 0.5 |
| PgBouncer | 1 | 64MB | 0.1 |
| Redis (queue) | 1 | 128MB | 0.1 |
| Redis (cache) | 1 | 64MB | 0.1 |
| **Total** | | **~1.6GB** | **~1.6 CPU** |

### Medium (10–100 workspaces, 1000 publications/day)
| Service | Replicas | Memory | CPU |
|---------|----------|--------|-----|
| App | 2 | 1GB each | 1.0 each |
| Worker | 1 | 512MB | 0.5 |
| Realtime | 1 | 256MB | 0.25 |
| PostgreSQL | 1 | 1GB | 1.0 |
| PgBouncer | 1 | 128MB | 0.25 |
| Redis (queue) | 1 | 256MB | 0.25 |
| Redis (cache) | 1 | 128MB | 0.1 |
| **Total** | | **~4.3GB** | **~4.4 CPU** |

### Large (100+ workspaces, 10000+ publications/day)
| Service | Replicas | Memory | CPU |
|---------|----------|--------|-----|
| App | 3+ | 1GB each | 1.0 each |
| Worker | 2+ | 512MB each | 0.5 each |
| Realtime | 2+ | 256MB each | 0.25 each |
| PostgreSQL | 1 (with read replica) | 2GB | 2.0 |
| PgBouncer | 1 | 256MB | 0.25 |
| Redis (queue) | 1 (with replica) | 512MB | 0.5 |
| Redis (cache) | 1 | 256MB | 0.25 |
| **Total** | | **~8GB+** | **~8+ CPU** |

## PgBouncer pool sizing

Formula: `pool_size = (app_replicas × connection_limit) + worker_replicas + safety_margin`

Example (medium): `2 × 10 + 1 + 5 = 26` → set `DEFAULT_POOL_SIZE=30`

## Redis memory

- Queue Redis: `noeviction`, AOF. 10,000 queued jobs ≈ 5MB. Set `maxmemory 256mb`.
- Cache Redis: `allkeys-lru`, no persistence. 500 sockets ≈ 5MB. Set `maxmemory 128mb`.

## Schedule burst capacity

- BullMQ limiter: `max: 10, duration: 1000` (10 jobs/sec globally)
- Per-provider rate limits: Telegram 30/s, Instagram 200/hr, LinkedIn ~90/day
- Worker concurrency: 5 (default), 10 (medium), 20 (large)

## Monitoring thresholds

- Queue depth > 100 → warning, > 500 → critical
- PostgreSQL connections > 80% → warning
- Redis memory > 80% → warning
- App memory > 90% → critical
- Publication success < 99% → SLO burn alert
