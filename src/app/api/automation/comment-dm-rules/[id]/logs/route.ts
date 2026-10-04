import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { isEnabled } from '@/lib/flags'
import { validateId } from '@/lib/validations'
import { listRuleRuns } from '@/modules/automation/comment-dm'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('content.publish')
  if (guard.error) return guard.error
  if (!(await isEnabled('comment_dm_beta', guard.workspaceId))) {
    return NextResponse.json({ error: 'این قابلیت در مرحله بتا است' }, { status: 403 })
  }
  const { id } = await params
  const checked = validateId(id)
  if (!checked.success) return NextResponse.json({ error: checked.error }, { status: 400 })
  const runs = await listRuleRuns(guard.workspaceId, checked.data)
  if (!runs) return NextResponse.json({ error: 'مورد یافت نشد' }, { status: 404 })
  return NextResponse.json({ runs })
}
