# Capacity Sizing

## Deployment Sizes

### Small (≤ 100 users, ≤ 1K publications/day)
| Service | Memory | CPU | Replicas |
|---------|--------|-----|----------|
| App | 1GB | 1.0 | 1 |
| Worker | 512MB | 0.5 | 1 |
| Realtime | 256MB | 0.25 | 1 |
| PostgreSQL | 1GB | 1.0 | 1 |
| Redis | 512MB | 0.5 | 1 |
| PgBouncer | 256MB | 0.25 | 1 |

### Medium (≤ 1K users, ≤ 10K publications/day)
| Service | Memory | CPU | Replicas |
|---------|--------|-----|----------|
| App | 2GB | 2.0 | 2 |
| Worker | 1GB | 1.0 | 2 |
| Realtime | 512MB | 0.5 | 2 |
| PostgreSQL | 4GB | 2.0 | 1 (read replica) |
| Redis | 1GB | 1.0 | 1 |
| PgBouncer | 512MB | 0.5 | 1 |

### Large (≤ 10K users, ≤ 100K publications/day)
| Service | Memory | CPU | Replicas |
|---------|--------|-----|----------|
| App | 4GB | 4.0 | 4 |
| Worker | 2GB | 2.0 | 4 |
| Realtime | 1GB | 1.0 | 3 |
| PostgreSQL | 8GB | 4.0 | 1 + 2 read replicas |
| Redis | 4GB | 2.0 | 1 + replica |
| PgBouncer | 1GB | 1.0 | 2 |

## PgBouncer Pool Sizing Formula
```
pool_size = max(10, min(100, concurrent_users / 10))
```

## Redis Memory Sizing
```
redis_memory = max(256MB, queue_depth_peak * 10KB)
```
