/**
 * POST /api/inbox/[id]/read — mark an inbox message as read.
 * Also supports bulk mark-read via POST /api/inbox/read-all.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWorkspaceId } from "@/lib/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 403 });

  const message = await db.inboxMessage.findFirst({
    where: { id, workspaceId },
  });
  if (!message) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.inboxMessage.update({
    where: { id },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
