import { describe, it, expect } from 'vitest'
import { can, type Role, type Permission } from '../../../src/lib/auth-guards'

/**
 * Issue #142: Table-driven tests for every role × permission combination.
 *
 * These tests prove the RBAC matrix is correct and that removing any
 * permission check would cause a test failure (acceptance criterion).
 */

const ALL_ROLES: Role[] = ['admin', 'editor', 'approver', 'viewer']
const ALL_PERMISSIONS: Permission[] = [
  'content.create',
  'content.edit',
  'content.delete',
  'content.review',
  'content.publish',
  'job.schedule',
  'job.cancel',
  'platform.manage',
  'platform.connect',
  'inbox.reply',
  'inbox.assign',
  'member.invite',
  'member.remove',
  'billing.manage',
  'security.admin',
  'analytics.view',
  'media.upload',
  'media.delete',
  'workspace.settings',
]

describe('Issue #142 — RBAC permission matrix', () => {
  describe('admin has all permissions', () => {
    for (const perm of ALL_PERMISSIONS) {
      it(`admin CAN ${perm}`, () => {
        expect(can('admin', perm)).toBe(true)
      })
    }
  })

  describe('viewer has no permissions', () => {
    for (const perm of ALL_PERMISSIONS) {
      it(`viewer CANNOT ${perm}`, () => {
        expect(can('viewer', perm)).toBe(false)
      })
    }
  })

  describe('editor permissions', () => {
    const editorCan: Permission[] = [
      'content.create',
      'content.edit',
      'content.publish',
      'job.schedule',
      'job.cancel',
      'platform.manage',
      'inbox.reply',
      'inbox.assign',
      'analytics.view',
      'media.upload',
    ]
    const editorCannot: Permission[] = ALL_PERMISSIONS.filter(
      (p) => !editorCan.includes(p)
    )

    for (const perm of editorCan) {
      it(`editor CAN ${perm}`, () => {
        expect(can('editor', perm)).toBe(true)
      })
    }
    for (const perm of editorCannot) {
      it(`editor CANNOT ${perm}`, () => {
        expect(can('editor', perm)).toBe(false)
      })
    }

    // Issue #142: editors CANNOT manage platform credentials (admin-only for secret safety)
    it('editor CANNOT connect platform credentials (secret safety)', () => {
      expect(can('editor', 'platform.connect')).toBe(false)
    })

    // Issue #142: editors CANNOT invite members
    it('editor CANNOT invite members', () => {
      expect(can('editor', 'member.invite')).toBe(false)
    })
  })

  describe('approver permissions', () => {
    const approverCan: Permission[] = ['content.review', 'analytics.view']
    const approverCannot: Permission[] = ALL_PERMISSIONS.filter(
      (p) => !approverCan.includes(p)
    )

    for (const perm of approverCan) {
      it(`approver CAN ${perm}`, () => {
        expect(can('approver', perm)).toBe(true)
      })
    }
    for (const perm of approverCannot) {
      it(`approver CANNOT ${perm}`, () => {
        expect(can('approver', perm)).toBe(false)
      })
    }
  })

  describe('fail-closed for unknown roles (Issue #142)', () => {
    it('unknown role string gets no permissions', () => {
      // @ts-expect-error — testing runtime with an invalid role
      expect(can('superadmin', 'content.publish')).toBe(false)
    })

    it('empty role string gets no permissions', () => {
      // @ts-expect-error — testing runtime with an invalid role
      expect(can('', 'content.publish')).toBe(false)
    })

    it('null role gets no permissions', () => {
      // @ts-expect-error — testing runtime with null
      expect(can(null, 'content.publish')).toBe(false)
    })

    it('undefined role gets no permissions', () => {
      // @ts-expect-error — testing runtime with undefined
      expect(can(undefined, 'content.publish')).toBe(false)
    })
  })

  describe('fail-closed for unknown permissions', () => {
    it('unknown permission string returns false', () => {
      // @ts-expect-error — testing runtime with an invalid permission
      expect(can('admin', 'nonexistent.permission')).toBe(false)
    })
  })

  describe('critical security boundaries (Issue #142 acceptance criteria)', () => {
    it('viewer CANNOT invite members (vertical privilege escalation)', () => {
      expect(can('viewer', 'member.invite')).toBe(false)
    })

    it('viewer CANNOT publish content', () => {
      expect(can('viewer', 'content.publish')).toBe(false)
    })

    it('viewer CANNOT connect platform credentials', () => {
      expect(can('viewer', 'platform.connect')).toBe(false)
    })

    it('viewer CANNOT delete content', () => {
      expect(can('viewer', 'content.delete')).toBe(false)
    })

    it('viewer CANNOT access security admin controls', () => {
      expect(can('viewer', 'security.admin')).toBe(false)
    })

    it('editor CANNOT delete content (only admin)', () => {
      expect(can('editor', 'content.delete')).toBe(false)
    })

    it('editor CANNOT manage billing (only admin)', () => {
      expect(can('editor', 'billing.manage')).toBe(false)
    })

    it('approver CANNOT publish content (only review)', () => {
      expect(can('approver', 'content.publish')).toBe(false)
    })

    it('approver CANNOT create content', () => {
      expect(can('approver', 'content.create')).toBe(false)
    })
  })

  describe('matrix completeness', () => {
    it('every permission is defined in the matrix', () => {
      // If a permission is added to the Permission type but not the MATRIX,
      // can() would return false for admin — which would break this test
      for (const perm of ALL_PERMISSIONS) {
        expect(can('admin', perm)).toBe(true)
      }
    })
  })
})
