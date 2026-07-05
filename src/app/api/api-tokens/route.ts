/**
 * Issue #255: API tokens — list + create.
 *
 *   GET    /api/api-tokens  — list all tokens for the workspace (no hashes)
 *   POST   /api/api-tokens  — create a new token, return plaintext ONCE (201)
 *
 * Both require `workspace.settings` (admin-only). The plaintext token is
 * returned in the POST response body and never persisted — only its SHA-256
 * hash is stored. Clients must capture it on creation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, apiTokenCreateSchema } from '@/lib/validations'
import { apiTokensService, ApiTokenError } from '@/modules/api-tokens'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error

  try {
    const tokens = await apiTokensService.list(guard.workspaceId)
    return NextResponse.json(tokens)
  } catch (err) {
    if (err instanceof ApiTokenError) {
      return NextResponse.json(
        { error: err.userMessage ?? err.message },
        { status: err.statusCode }
      )
    }
    throw err
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error

  const raw = await req.json().catch(() => null)
  if (!raw) {
    return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  }

  const validation = validateBody(apiTokenCreateSchema, raw)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const result = await apiTokensService.create(
      guard.workspaceId,
      guard.userId,
      validation.data
    )
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof ApiTokenError) {
      return NextResponse.json(
        { error: err.userMessage ?? err.message },
        { status: err.statusCode }
      )
    }
    throw err
  }
}
