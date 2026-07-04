import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { isEnabled } from '@/lib/flags'
import { listRules, createRule } from '@/modules/automation/comment-dm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('content.publish')
  if (guard.error) return guard.error

  if (!(await isEnabled('comment_dm_beta', guard.workspaceId))) {
    return NextResponse.json({ error: 'این قابلیت در مرحله بتا است' }, { status: 403 })
  }

  const rules = await listRules(guard.workspaceId)
  return NextResponse.json(rules)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('content.publish')
  if (guard.error) return guard.error

  if (!(await isEnabled('comment_dm_beta', guard.workspaceId))) {
    return NextResponse.json({ error: 'این قابلیت در مرحله بتا است' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const rule = await createRule(guard.workspaceId, body)
    return NextResponse.json(rule, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
