/**
 * Issue #124: Publications domain module — permissions.
 *
 * Thin wrapper around the global can() helper so the route handler can check
 * permissions without importing from auth-guards directly. This also makes
 * the permission check mockable in service-layer tests.
 */

import { can, type Role, type Permission } from '@/lib/auth-guards'

export function canPublish(role: string): boolean {
  return can(role as Role, 'content.publish' as Permission)
}
