/**
 * POST /api/inbox/[id]/reply — reply to an inbox message.
 * Marks the message as replied + stores the reply text.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWorkspaceId } from "@/lib/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { reply } = body;

  if (!reply || typeof reply !== "string" || reply.trim().length === 0) {
    return NextResponse.json({ error: "متن پاسخ خالی است" }, { status: 400 });
  }

  const message = await db.inboxMessage.findFirst({
    where: { id, workspaceId },
  });
  if (!message) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const updated = await db.inboxMessage.update({
    where: { id },
    data: {
      reply: reply.trim(),
      isReplied: true,
      isRead: true,
    },
  });

  return NextResponse.json({
    ok: true,
    reply: updated.reply,
    isReplied: updated.isReplied,
  });
}
