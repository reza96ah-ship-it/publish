/**
 * Issue #157: Test datasets for performance/load testing.
 *
 * Repeatable synthetic datasets for small/normal/large workspaces.
 * Preserves tenant isolation — contains no customer data.
 */

export interface WorkspaceDataset {
  name: string
  description: string
  users: number
  channels: number
  contentRecords: number
  publicationRecords: number
  mediaRecords: number
  inboxMessages: number
  auditEntries: number
}

export const SMALL_WORKSPACE: WorkspaceDataset = {
  name: 'small',
  description: 'Small workspace: 1 user, 2 channels, 100 content records',
  users: 1,
  channels: 2,
  contentRecords: 100,
  publicationRecords: 200,
  mediaRecords: 50,
  inboxMessages: 10,
  auditEntries: 500,
}

export const NORMAL_WORKSPACE: WorkspaceDataset = {
  name: 'normal',
  description: 'Normal workspace: 10 users, 10 channels, 10,000 content records',
  users: 10,
  channels: 10,
  contentRecords: 10_000,
  publicationRecords: 20_000,
  mediaRecords: 5_000,
  inboxMessages: 1_000,
  auditEntries: 50_000,
}

export const LARGE_WORKSPACE: WorkspaceDataset = {
  name: 'large',
  description: 'Large workspace: 50 users, 20 channels, 100,000 content records',
  users: 50,
  channels: 20,
  contentRecords: 100_000,
  publicationRecords: 200_000,
  mediaRecords: 50_000,
  inboxMessages: 10_000,
  auditEntries: 500_000,
}

export const SCHEDULED_BURST: WorkspaceDataset = {
  name: 'scheduled-burst',
  description: 'Scheduled burst: many publications sharing the same target minute',
  users: 5,
  channels: 5,
  contentRecords: 500,
  publicationRecords: 500, // all scheduled for the same minute
  mediaRecords: 100,
  inboxMessages: 0,
  auditEntries: 1_000,
}

export const MEDIA_HEAVY: WorkspaceDataset = {
  name: 'media-heavy',
  description: 'Large media library with mixed image/video content',
  users: 3,
  channels: 5,
  contentRecords: 1_000,
  publicationRecords: 2_000,
  mediaRecords: 10_000, // 10K media files
  inboxMessages: 100,
  auditEntries: 5_000,
}

export const ALL_DATASETS: WorkspaceDataset[] = [
  SMALL_WORKSPACE,
  NORMAL_WORKSPACE,
  LARGE_WORKSPACE,
  SCHEDULED_BURST,
  MEDIA_HEAVY,
]

/**
 * Generate synthetic Persian content for testing.
 * Ensures RTL text, mixed Persian/Latin, and realistic content patterns.
 */
export function generatePersianTitle(index: number): string {
  const templates = [
    'پست شماره {n} — بازاریابی دیجیتال',
    'کمپین تابستانه {n} — تخفیف ویژه',
    'محتوای آموزشی {n} — نکات سئو',
    'اخبار صنعت {n} — تحلیل بازار',
    'رویداد {n} — ثبت‌نام زودهنگام',
  ]
  return templates[index % templates.length].replace('{n}', String(index))
}

export function generatePersianCaption(index: number): string {
  return `این پست شماره ${index} است. محتوای تستی برای ارزیابی عملکرد سیستم. ` +
    `شامل متن فارسی و کاراکترهای RTL است. #تست #بار #عملکرد`
}

/**
 * Get the dataset for a given name.
 */
export function getDataset(name: string): WorkspaceDataset {
  const dataset = ALL_DATASETS.find(d => d.name === name)
  if (!dataset) {
    throw new Error(`Unknown dataset: ${name}. Available: ${ALL_DATASETS.map(d => d.name).join(', ')}`)
  }
  return dataset
}
