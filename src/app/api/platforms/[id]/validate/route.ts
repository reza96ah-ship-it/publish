/**
 * POST /api/platforms/[id]/validate — test connection by calling getMe.
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

  const platform = await db.platform.findFirst({ where: { id, workspaceId } });
  if (!platform) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!platform.tokenSecret) {
    return NextResponse.json({ error: "توکن تنظیم نشده است" }, { status: 400 });
  }

  let valid = false;
  let botInfo: any = null;

  if (platform.type === "telegram") {
    try {
      const res = await fetch(`https://api.telegram.org/bot${platform.tokenSecret}/getMe`);
      const data = await res.json();
      valid = data.ok;
      botInfo = data.result;
    } catch {}
  } else if (platform.type === "bale") {
    try {
      const res = await fetch(`https://tapi.bale.ai/bot${platform.tokenSecret}/getMe`);
      const data = await res.json();
      valid = data.ok;
      botInfo = data.result;
    } catch {}
  } else if (platform.type === "rubika") {
    try {
      const res = await fetch(`https://botapi.rubika.ir/v3/${platform.tokenSecret}/getMe`, { method: "POST" });
      const data = await res.json();
      valid = data.status === "OK" || data.ok;
      botInfo = data.data || data.result;
    } catch {}
  } else {
    valid = true;
  }

  // Update platform status
  await db.platform.update({
    where: { id },
    data: {
      status: valid ? "active" : "error",
      lastError: valid ? null : "اعتبارسنجی ناموفق",
    },
  });

  return NextResponse.json({
    valid,
    botInfo: botInfo ? { username: botInfo.username, firstName: botInfo.first_name } : null,
  });
}
