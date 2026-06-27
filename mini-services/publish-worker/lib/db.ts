/**
 * Prisma client for the publish worker.
 * The worker shares the root Prisma schema and DATABASE_URL with the Next.js app.
 */
import { PrismaClient } from '@prisma/client'

export const db = new PrismaClient({
  log: ['warn', 'error'],
})

export const REALTIME_EMIT_URL = process.env.REALTIME_EMIT_URL || 'http://127.0.0.1:3003/emit'
