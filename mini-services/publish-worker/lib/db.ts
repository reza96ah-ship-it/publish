/**
 * Prisma client for the publish worker — points at the same SQLite DB
 * as the Next.js app (db/custom.db). The worker shares the schema.
 */
import { PrismaClient } from '@prisma/client'

export const db = new PrismaClient({
  log: ['warn', 'error'],
})

export const REALTIME_EMIT_URL = 'http://127.0.0.1:3003/emit'
