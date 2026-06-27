/**
 * POST /api/content/[id]/approve
 * Transitions content from review → approved.
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic'
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

  const content = await db.content.findFirst({
    where: { id, workspaceId },
  });
  if (!content) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (content.status !== "review") {
    return NextResponse.json(
      { error: "not_in_review", message: "فقط محتوای در حال بررسی می‌تواند تأیید شود" },
      { status: 400 },
    );
  }

  await db.content.update({
    where: { id },
    data: {
      status: "approved",
      approvedAt: new Date(),
      rejectedReason: null,
    },
  });

  // Notify team
  await db.notification.create({
    data: {
      workspaceId,
      type: "publish_success",
      title: "محتوا تأیید شد ✓",
      body: `«${content.title}» تأیید شد و آماده انتشار است`,
    },
  });

  return NextResponse.json({ ok: true, status: "approved" });
}
