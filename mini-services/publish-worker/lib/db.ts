import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? ''
const adapter = new PrismaPg({ connectionString: url })

export const db = new PrismaClient({
  adapter,
  log: ['warn', 'error'],
})

export const REALTIME_EMIT_URL = process.env.REALTIME_EMIT_URL || 'http://127.0.0.1:3003/emit'
