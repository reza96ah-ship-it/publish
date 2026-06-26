/**
 * POST /api/content/[id]/reject
 * Transitions content from review → rejected (with reason).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWorkspaceId } from "@/lib/server";
import { validateBody, contentRejectSchema } from "@/lib/validations";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 403 });

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: "بدنه نامعتبر" }, { status: 400 });

  const validation = validateBody(contentRejectSchema, raw);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { reason } = validation.data;

  const content = await db.content.findFirst({
    where: { id, workspaceId },
  });
  if (!content) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (content.status !== "review") {
    return NextResponse.json(
      { error: "not_in_review", message: "فقط محتوای در حال بررسی می‌تواند رد شود" },
      { status: 400 },
    );
  }

  await db.content.update({
    where: { id },
    data: {
      status: "rejected",
      rejectedReason: reason,
    },
  });

  // Notify team
  await db.notification.create({
    data: {
      workspaceId,
      type: "publish_failed",
      title: "محتوا نیاز به بازبینی دارد",
      body: `«${content.title}» — ${reason}`,
    },
  });

  return NextResponse.json({ ok: true, status: "rejected" });
}
