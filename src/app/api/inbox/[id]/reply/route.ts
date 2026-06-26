/**
 * POST /api/inbox/[id]/reply — reply to an inbox message.
 * Marks the message as replied + stores the reply text.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWorkspaceId } from "@/lib/server";
import { validateBody, inboxReplySchema } from "@/lib/validations";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 403 });

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: "بدنه نامعتبر" }, { status: 400 });

  const validation = validateBody(inboxReplySchema, raw);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { reply } = validation.data;

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
