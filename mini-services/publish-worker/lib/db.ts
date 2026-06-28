import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const url = process.env.DATABASE_URL ?? ''
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. For migrations use DIRECT_DATABASE_URL.')
}
const adapter = new PrismaPg({ connectionString: url })

export const db = new PrismaClient({
  adapter,
  log: ['warn', 'error'],
})

export const REALTIME_EMIT_URL = process.env.REALTIME_EMIT_URL || 'http://127.0.0.1:3003/emit'
