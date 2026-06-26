import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Query logging is noisy and slow in production — gate it to dev only,
// or enable explicitly via LOG_QUERIES=1.
const logQuery = process.env.NODE_ENV !== 'production' || process.env.LOG_QUERIES === '1'

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logQuery ? ['query', 'warn', 'error'] : ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
