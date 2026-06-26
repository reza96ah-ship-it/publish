/**
 * POST /api/platforms/[id]/connect — save bot token + chat ID for a platform.
 * Validates the token by calling the platform's getMe endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWorkspaceId } from "@/lib/server";
import { validateBody, platformConnectSchema } from "@/lib/validations";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 403 });

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: "بدنه نامعتبر" }, { status: 400 });

  const validation = validateBody(platformConnectSchema, raw);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { token, targetId, name } = validation.data;

  // Verify platform belongs to workspace
  const platform = await db.platform.findFirst({ where: { id, workspaceId } });
  if (!platform) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Validate token by calling the platform's getMe endpoint
  let valid = false;
  let botInfo: any = null;

  if (platform.type === "telegram") {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await res.json();
      valid = data.ok;
      botInfo = data.result;
    } catch {}
  } else if (platform.type === "bale") {
    try {
      const res = await fetch(`https://tapi.bale.ai/bot${token}/getMe`);
      const data = await res.json();
      valid = data.ok;
      botInfo = data.result;
    } catch {}
  } else if (platform.type === "rubika") {
    try {
      const res = await fetch(`https://botapi.rubika.ir/v3/${token}/getMe`, { method: "POST" });
      const data = await res.json();
      valid = data.status === "OK" || data.ok;
      botInfo = data.data || data.result;
    } catch {}
  } else {
    // For IG/LinkedIn — just save (OAuth flow would validate separately)
    valid = true;
  }

  if (!valid) {
    return NextResponse.json({ error: "توکن نامعتبر است — اتصال ناموفق بود" }, { status: 400 });
  }

  // Save token + target to platform
  await db.platform.update({
    where: { id },
    data: {
      tokenSecret: token,
      targetId: targetId || null,
      name: name || (botInfo?.username ? `@${botInfo.username}` : platform.name),
      username: botInfo?.username || platform.username,
      status: "active",
      lastError: null,
      circuitState: "closed",
    },
  });

  return NextResponse.json({
    ok: true,
    botInfo: botInfo ? { username: botInfo.username, firstName: botInfo.first_name } : null,
  });
}
