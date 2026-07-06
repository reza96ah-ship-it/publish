import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { validateRows, bulkCreate, CSV_TEMPLATE, CSV_MAX_ROWS } from '@/modules/content/csv-import'
import type { CsvRow } from '@/modules/content/csv-import'

export const dynamic = 'force-dynamic'

export async function GET() {
  return new NextResponse('﻿' + CSV_TEMPLATE, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="nashrino-import-template.csv"',
    },
  })
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('content.publish')
  if (guard.error) return guard.error

  const session = await getServerSession(authOptions)
  const workspaceId = guard.workspaceId

  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })
  }

  const rows: CsvRow[] = body.rows
  if (rows.length === 0) {
    return NextResponse.json({ error: 'فایل خالی است' }, { status: 400 })
  }
  if (rows.length > CSV_MAX_ROWS) {
    return NextResponse.json({ error: `حداکثر ${CSV_MAX_ROWS} ردیف مجاز است` }, { status: 400 })
  }

  const channels = await db.platform.findMany({
    where: { workspaceId, status: 'active' },
    select: { id: true, name: true, username: true, type: true },
  })

  const validated = validateRows(rows, channels)

  if (body.mode === 'validate') {
    const validCount = validated.filter(r => r.valid).length
    const errorCount = validated.length - validCount
    return NextResponse.json({ validated, validCount, errorCount })
  }

  if (body.mode === 'import') {
    const auth = {
      workspaceId,
      userId: session?.user?.id ?? '',
      authorName: session?.user?.name ?? '—',
      role: guard.role,
    }
    const result = await bulkCreate(auth, validated)
    return NextResponse.json(result, { status: 201 })
  }

  return NextResponse.json({ error: 'mode نامعتبر' }, { status: 400 })
}
