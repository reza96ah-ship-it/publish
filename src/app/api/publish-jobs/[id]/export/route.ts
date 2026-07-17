import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { fetchExportJob, buildExportZip } from '@/lib/export-package'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('job.schedule')
  if (guard.error) return guard.error

  const { id } = await params
  const job = await fetchExportJob(id, guard.workspaceId)

  if (!job) {
    return NextResponse.json({ error: 'کار انتشار یافت نشد' }, { status: 404 })
  }

  const { zipped, filename } = await buildExportZip(job)

  return new Response(zipped, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(zipped.byteLength),
    },
  })
}
