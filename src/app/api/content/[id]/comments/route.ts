/**
 * GET /api/content/[id]/comments — list comments for a content
 * POST /api/content/[id]/comments — add a comment
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWorkspaceId } from "@/lib/server";
import { validateBody, validateParams, validateId, contentCommentSchema, contentCommentsQuerySchema } from "@/lib/validations";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const idCheck = validateId(rawId);
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 });
  const id = idCheck.data;

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 403 });

  // Validate ?parentId= query (optional)
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const queryCheck = validateParams(contentCommentsQuerySchema, query);
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 });

  const comments = await db.contentComment.findMany({
    where: queryCheck.data.parentId ? { contentId: id, parentId: queryCheck.data.parentId } : { contentId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const idCheck = validateId(rawId);
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 });
  const id = idCheck.data;

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const validation = validateBody(contentCommentSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
  const { text, parentId } = validation.data;

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
