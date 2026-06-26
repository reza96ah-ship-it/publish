/**
 * DELETE /api/ai/drafts/[id] — delete an AI draft.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWorkspaceId } from "@/lib/server";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 403 });

  const draft = await db.content.findFirst({
    where: { id, workspaceId, status: "draft" },
  });
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.content.delete({ where: { id } });

  return NextResponse.json({ ok: true, id });
}
