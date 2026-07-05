/**
 * Nashrino feature flags — environment-driven with per-workspace DB overrides.
 *
 * Flags are evaluated server-side. Never expose raw flag config to the client.
 * Use the /api/flags route (or server component props) to pass resolved booleans.
 *
 * Flag naming: snake_case. Prefix experiments with exp_.
 *
 * Adding a flag:
 *   1. Add it to FLAG_DEFAULTS below with its default value.
 *   2. Set FEATURE_<FLAG_NAME_UPPER>=true in .env.staging to enable in staging.
 *   3. Use isEnabled('flag_name', workspaceId) in server code.
 *   4. Use the DB override for targeted rollout (workspace-level).
 */

import { db } from './db'

// ─── Flag registry ──────────────────────────────────────────────────────────

export type FlagName =
  | 'guided_onboarding'      // #244 — activation funnel UX
  | 'design_workbench'       // #245 — component gallery
  | 'ai_caption_v2'          // exp_ — improved caption model
  | 'utm_presets'            // #246 — UTM builder in compose
  | 'jalali_holidays'        // #222 — holiday overlay in calendar
  | 'comment_dm_beta'        // #209 — Instagram comment-to-DM automation (beta)

/** Default value (false = off for everyone unless overridden). */
const FLAG_DEFAULTS: Record<FlagName, boolean> = {
  guided_onboarding: false,
  design_workbench: false,
  ai_caption_v2: false,
  utm_presets: false,
  jalali_holidays: false,
  comment_dm_beta: false,
}

/** Persian labels + descriptions for the settings UI (served via /api/flags). */
export const FLAG_META: Record<FlagName, { label: string; description: string }> = {
  guided_onboarding: {
    label: 'راه‌اندازی گام‌به‌گام',
    description: 'راهنمای تعاملی شروع کار برای اعضای جدید فضای کار',
  },
  design_workbench: {
    label: 'کارگاه طراحی',
    description: 'گالری کامپوننت‌های سیستم طراحی (مخصوص توسعه‌دهندگان)',
  },
  ai_caption_v2: {
    label: 'کپشن هوشمند نسخه ۲',
    description: 'مدل بهبودیافتهٔ تولید کپشن با هوش مصنوعی',
  },
  utm_presets: {
    label: 'قالب‌های UTM',
    description: 'ساخت و مدیریت پارامترهای UTM در صفحه ایجاد محتوا',
  },
  jalali_holidays: {
    label: 'مناسبت‌های شمسی',
    description: 'نمایش تعطیلات رسمی ایران در تقویم و پیشنهاد مناسبت‌ها',
  },
  comment_dm_beta: {
    label: 'دایرکت خودکار از کامنت (بتا)',
    description: 'ارسال خودکار پیام دایرکت اینستاگرام در پاسخ به کامنت‌های دارای کلیدواژه',
  },
}

// ─── Evaluation ─────────────────────────────────────────────────────────────

function envKey(flag: FlagName) {
  return `FEATURE_${flag.toUpperCase()}`
}

function envValue(flag: FlagName): boolean | undefined {
  const raw = process.env[envKey(flag)]
  if (raw === undefined) return undefined
  return raw === '1' || raw.toLowerCase() === 'true'
}

/**
 * Evaluate a single feature flag for a workspace.
 *
 * Priority (highest first):
 *   1. DB workspace override (FeatureFlag model, if present)
 *   2. Environment variable (FEATURE_<FLAG>)
 *   3. FLAG_DEFAULTS
 */
export async function isEnabled(flag: FlagName, workspaceId: string): Promise<boolean> {
  // DB override (workspace-specific rollout)
  try {
    const override = await db.featureFlag.findUnique({
      where: { workspaceId_flag: { workspaceId, flag } },
      select: { enabled: true },
    })
    if (override !== null) return override.enabled
  } catch {
    // FeatureFlag table may not exist in older migrations — fall through to env
  }

  // Env variable
  const envResult = envValue(flag)
  if (envResult !== undefined) return envResult

  // Default
  return FLAG_DEFAULTS[flag] ?? false
}

/**
 * Evaluate all flags for a workspace in one call.
 * Returns a plain object safe to pass to client components via props.
 */
export async function evaluateFlags(
  workspaceId: string,
): Promise<Record<FlagName, boolean>> {
  const names = Object.keys(FLAG_DEFAULTS) as FlagName[]
  const values = await Promise.all(names.map((f) => isEnabled(f, workspaceId)))
  return Object.fromEntries(names.map((f, i) => [f, values[i]])) as Record<FlagName, boolean>
}

/** True when the name is a registered flag (narrow untrusted input). */
export function isFlagName(name: string): name is FlagName {
  return name in FLAG_DEFAULTS
}

/**
 * Set a per-workspace DB override for a flag (settings UI / targeted rollout).
 */
export async function setFlag(
  workspaceId: string,
  flag: FlagName,
  enabled: boolean,
): Promise<void> {
  await db.featureFlag.upsert({
    where: { workspaceId_flag: { workspaceId, flag } },
    create: { workspaceId, flag, enabled },
    update: { enabled },
  })
}
