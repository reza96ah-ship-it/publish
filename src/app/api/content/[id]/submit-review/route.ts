/**
 * POST /api/content/[id]/submit-review
 * Transitions content from draft/rejected → review (submit for approval).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWorkspaceId } from "@/lib/server";
import { validateId } from "@/lib/validations";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const idCheck = validateId(rawId);
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 });
  const id = idCheck.data;

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 403 });

  const content = await db.content.findFirst({
    where: { id, workspaceId },
  });
  if (!content) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // State machine: only draft or rejected can go to review
  if (content.status !== "draft" && content.status !== "rejected") {
    return NextResponse.json(
      { error: "invalid_transition", message: "فقط محتوای پیش‌نویس یا ردشده می‌تواند برای بررسی ارسال شود" },
      { status: 400 },
    );
  }

  // Save version snapshot before submitting
  await db.contentVersion.create({
    data: {
      contentId: id,
      body: content.body ?? "",
      editedBy: "submitter",
      editSummary: "ارسال برای بررسی",
    },
  });

  // Transition to review
  await db.content.update({
    where: { id },
    data: {
      status: "review",
      rejectedReason: null,
    },
  });

  // Notify approvers
  const approvers = await db.workspaceMember.findMany({
    where: { workspaceId, role: { in: ["admin", "approver"] } },
  });
  await db.notification.createMany({
    data: approvers.map(() => ({
      workspaceId,
      type: "approval_requested",
      title: "محتوای جدید برای تأیید",
      body: content.title,
    })),
  });

  return NextResponse.json({ ok: true, status: "review" });
}
