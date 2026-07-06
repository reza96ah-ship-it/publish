import { describe, it, expect } from 'vitest'
import { can, type Role, type Permission } from '../../../src/lib/auth-guards'

describe('God-node: can() RBAC matrix', () => {
  const roles: Role[] = ['admin', 'editor', 'approver', 'viewer']

  const permissions: Permission[] = [
    'content.create',
    'content.edit',
    'content.delete',
    'content.review',
    'content.publish',
    'job.schedule',
    'job.cancel',
    'platform.manage',
    'inbox.reply',
    'member.invite',
    'billing.manage',
  ]

  describe('admin role', () => {
    it('has all permissions', () => {
      for (const perm of permissions) {
        expect(can('admin', perm)).toBe(true)
      }
    })
  })

  describe('editor role', () => {
    it('can create, edit, publish, schedule, cancel, manage platforms, reply to inbox', () => {
      expect(can('editor', 'content.create')).toBe(true)
      expect(can('editor', 'content.edit')).toBe(true)
      expect(can('editor', 'content.publish')).toBe(true)
      expect(can('editor', 'job.schedule')).toBe(true)
      expect(can('editor', 'job.cancel')).toBe(true)
      expect(can('editor', 'platform.manage')).toBe(true)
      expect(can('editor', 'inbox.reply')).toBe(true)
    })

    it('cannot delete content, review, invite members, manage billing', () => {
      expect(can('editor', 'content.delete')).toBe(false)
      expect(can('editor', 'content.review')).toBe(false)
      expect(can('editor', 'member.invite')).toBe(false)
      expect(can('editor', 'billing.manage')).toBe(false)
    })
  })

  describe('approver role', () => {
    it('can review content', () => {
      expect(can('approver', 'content.review')).toBe(true)
    })

    it('cannot create, edit, publish, delete, schedule, manage, invite, bill', () => {
      expect(can('approver', 'content.create')).toBe(false)
      expect(can('approver', 'content.edit')).toBe(false)
      expect(can('approver', 'content.publish')).toBe(false)
      expect(can('approver', 'content.delete')).toBe(false)
      expect(can('approver', 'job.schedule')).toBe(false)
      expect(can('approver', 'member.invite')).toBe(false)
      expect(can('approver', 'billing.manage')).toBe(false)
    })
  })

  describe('viewer role', () => {
    it('has no permissions', () => {
      for (const perm of permissions) {
        expect(can('viewer', perm)).toBe(false)
      }
    })
  })

  describe('invalid inputs', () => {
    it('returns false for unknown permission', () => {
      expect(can('admin', 'nonexistent.permission' as Permission)).toBe(false)
    })
  })

  describe('all role/perm combinations are deterministic', () => {
    it('returns same result on repeated calls', () => {
      for (const role of roles) {
        for (const perm of permissions) {
          const r1 = can(role, perm)
          const r2 = can(role, perm)
          expect(r1).toBe(r2)
        }
      }
    })
  })
})
