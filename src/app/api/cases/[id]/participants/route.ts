/**
 * Issue #248: Case participants API — add + remove.
 *
 *   POST   /api/cases/[id]/participants?participantId=...   — add a customer to a case
 *   DELETE /api/cases/[id]/participants?participantId=...   — remove a participant
 *
 * Permission: workspace.settings OR inbox.reply. One customer can be added to
 * a case at most once (enforced by @@unique([caseId, customerId])).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAnyPermissionApi } from '@/lib/auth-guards'
import { validateBody, validateId, caseParticipantSchema } from '@/lib/validations'
import { customersService, CustomerError } from '@/modules/customers'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof CustomerError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAnyPermissionApi(['workspace.settings', 'inbox.reply'])
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(caseParticipantSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    const participant = await customersService.addParticipant(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
      v.data
    )
    return NextResponse.json(participant, { status: 201 })
  } catch (err) { return mapError(err) }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAnyPermissionApi(['workspace.settings', 'inbox.reply'])
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const participantId = req.nextUrl.searchParams.get('participantId')
  if (!participantId) {
    return NextResponse.json({ error: 'شناسه شرکت‌کننده الزامی است' }, { status: 400 })
  }
  try {
    await customersService.removeParticipant(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
      participantId
    )
    return new NextResponse(null, { status: 204 })
  } catch (err) { return mapError(err) }
}
