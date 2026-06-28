/**
 * Prisma client for the realtime service — used for workspace membership checks.
 *
 * Uses the same @prisma/client as the root app (Prisma 7.8.0 with @prisma/adapter-pg).
 * KEEP the Prisma version in sync with the root package.json.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const url = process.env.DATABASE_URL ?? ''
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the realtime service')
}
const adapter = new PrismaPg({ connectionString: url })

export const db = new PrismaClient({
  adapter,
  log: ['warn', 'error'],
})
