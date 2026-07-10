import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. For migrations use DIRECT_DATABASE_URL.')
  }
  const logQuery = process.env.NODE_ENV !== 'production' || process.env.LOG_QUERIES === '1'
  return new PrismaClient({
    log: logQuery ? ['query', 'warn', 'error'] : ['warn', 'error'],
  })
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
