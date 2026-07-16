import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createClient() {
  const url = process.env.DATABASE_URL ?? ''
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. For migrations use DIRECT_DATABASE_URL.')
  }
  const adapter = new PrismaPg({ connectionString: url })
  // Query logging is opt-in (LOG_QUERIES=1) — with dashboard polling it
  // floods the dev console and noticeably slows the dev server.
  const logQuery = process.env.LOG_QUERIES === '1'
  return new PrismaClient({
    adapter,
    log: logQuery ? ['query', 'warn', 'error'] : ['warn', 'error'],
  })
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
