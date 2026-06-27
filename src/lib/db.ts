import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createClient() {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? ''
  const adapter = new PrismaPg({ connectionString: url })
  const logQuery = process.env.NODE_ENV !== 'production' || process.env.LOG_QUERIES === '1'
  return new PrismaClient({
    adapter,
    log: logQuery ? ['query', 'warn', 'error'] : ['warn', 'error'],
  })
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
