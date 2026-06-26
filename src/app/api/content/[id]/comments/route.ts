/**
 * GET /api/content/[id]/comments — list comments for a content
 * POST /api/content/[id]/comments — add a comment
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWorkspaceId } from "@/lib/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 403 });

  const comments = await db.contentComment.findMany({
    where: { contentId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { text, parentId } = body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "empty_comment" }, { status: 400 });
  }

  // Verify content belongs to workspace
  const content = await db.content.findFirst({
    where: { id, workspaceId },
  });
  if (!content) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const comment = await db.contentComment.create({
    data: {
      contentId: id,
      userId: "current-user",
      userName: "کاربر",
      body: text.trim(),
      parentId: parentId ?? null,
    },
  });

  return NextResponse.json(comment);
}
