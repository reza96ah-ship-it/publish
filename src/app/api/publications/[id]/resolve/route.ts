/**
 * POST /api/publications/[id]/resolve — manual resolution for unknown outcomes (Issue #149).
 *
 * Admin-only (security.admin). Allows an operator to manually resolve a
 * publication stuck in 'outcome_unknown' state after reconciliation failed.
 *
 * Issue #200: thin handler. Switch logic, audit, and outbox re-dispatch live
 * in src/modules/publications/service.ts (PublicationsService.resolve).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { z } from 'zod'
import {
  publicationsService,
  PublicationError,
  type ResolveRequest,
} from '@/modules/publications'

export const dynamic = 'force-dynamic'

const resolveSchema = z.object({
  action: z.enum(['mark_published', 'confirm_failure', 'abandon', 'duplicate_safe_retry']),
  providerPostId: z.string().optional(),
  reason: z.string().min(10, 'دلیل الزامی است (حداقل ۱۰ کاراکتر)'),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })

  const guard = await requirePermissionApi('security.admin')
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = resolveSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? 'نامعتبر' },
      { status: 400 },
    )
  }

  try {
    const result = await publicationsService.resolve(
      { workspaceId: guard.workspaceId, userId: guard.userId, authorName: '', role: guard.role },
      idCheck.data,
      validation.data as ResolveRequest,
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof PublicationError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}
