import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, validateParams, campaignCreateSchema, cursorPaginationSchema } from '@/lib/validations'
import { campaignsService } from '@/modules/campaigns'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(cursorPaginationSchema, query)
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })

  const result = await campaignsService.listCampaigns(
    { workspaceId: guard.workspaceId, userId: guard.userId },
    queryCheck.data
  )
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = validateBody(campaignCreateSchema, body)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })

  const campaign = await campaignsService.createCampaign(
    { workspaceId: guard.workspaceId, userId: guard.userId },
    validation.data
  )
  return NextResponse.json(campaign, { status: 201 })
}
