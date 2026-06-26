/**
 * POST /api/inbox/[id]/assign — assign an inbox message to a team member.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWorkspaceId } from "@/lib/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { assigneeId } = body;

  const message = await db.inboxMessage.findFirst({
    where: { id, workspaceId },
  });
  if (!message) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // If assigneeId is provided, verify the member belongs to this workspace
  if (assigneeId) {
    const member = await db.workspaceMember.findFirst({
      where: { id: assigneeId, workspaceId },
    });
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });
  }

  const updated = await db.inboxMessage.update({
    where: { id },
    data: { assigneeId: assigneeId ?? null },
  });

  return NextResponse.json({
    ok: true,
    assigneeId: updated.assigneeId,
  });
}
