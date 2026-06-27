/**
 * POST /api/inbox/[id]/read — mark an inbox message as read.
 * Also supports bulk mark-read via POST /api/inbox/read-all.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { validateId } from "@/lib/validations";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const idCheck = validateId(rawId);
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 });
  const id = idCheck.data;

  const guard = await requireWorkspaceApi();
  if (guard.error) return guard.error;
  const workspaceId = guard.workspace.id;

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
