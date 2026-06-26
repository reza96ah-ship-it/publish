/**
 * POST /api/members/invite — invite a team member by email.
 * Creates a WorkspaceMember with role + generates invite token.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWorkspaceId } from "@/lib/server";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 403 });

  const body = await req.json();
  const { email, name, role } = body;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "ایمیل معتبر وارد کنید" }, { status: 400 });
  }
  if (!["admin", "editor", "approver", "viewer"].includes(role)) {
    return NextResponse.json({ error: "نقش نامعتبر" }, { status: 400 });
  }

  // Check if member already exists
  const existing = await db.workspaceMember.findFirst({
    where: { workspaceId, email },
  });
  if (existing) {
    return NextResponse.json({ error: "این عضو قبلاً اضافه شده است" }, { status: 409 });
  }

  // Create member with a temporary userId (will be linked when user registers)
  const inviteToken = randomUUID();
  const member = await db.workspaceMember.create({
    data: {
      workspaceId,
      userId: inviteToken, // temporary — replaced when user accepts invite
      name: name || email.split("@")[0],
      email,
      role,
    },
  });

  // Create notification
  await db.notification.create({
    data: {
      workspaceId,
      type: "approval_requested",
      title: "عضو جدید اضافه شد",
      body: `${name || email} با نقش ${role} به تیم اضافه شد`,
    },
  });

  return NextResponse.json({
    ok: true,
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
    },
    inviteToken,
  }, { status: 201 });
}
