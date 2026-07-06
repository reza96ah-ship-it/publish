/**
 * Issue #156: Architecture enforcement tests.
 *
 * These tests enforce module boundaries:
 *   1. Domain modules must not import Next.js request/response objects
 *   2. Domain modules must not import UI components
 *   3. Provider capabilities must be in sync between app and worker
 *   4. No unjustified `any` in critical domain modules
 *   5. Route handlers should be thin (transport only)
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

const SRC_DIR = join(process.cwd(), 'src')
const MODULES_DIR = join(SRC_DIR, 'modules')

function listTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...listTsFiles(fullPath))
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(fullPath)
    }
  }
  return results
}

function readFile(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('Issue #156 — Architecture enforcement', () => {
  describe('domain modules must not import Next.js transport', () => {
    const moduleFiles = listTsFiles(MODULES_DIR)

    it('module files exist', () => {
      expect(moduleFiles.length).toBeGreaterThan(0)
    })

    for (const file of moduleFiles) {
      const relPath = file.replace(process.cwd(), '').replace(/\\/g, '/')
      it(`${relPath} does not import next/server or next/navigation`, () => {
        const content = readFile(file)
        expect(content).not.toMatch(/from\s+['"]next\/server['"]/)
        expect(content).not.toMatch(/from\s+['"]next\/navigation['"]/)
      })

      it(`${relPath} does not import UI components`, () => {
        const content = readFile(file)
        expect(content).not.toMatch(/from\s+['"]@\/components\//)
      })
    }
  })

  describe('provider capabilities are in sync', () => {
    it('app and worker capability files export identical data', () => {
      const appFile = readFile(join(SRC_DIR, 'lib', 'provider-capabilities.ts'))
      const workerFile = readFile(join(process.cwd(), 'mini-services', 'publish-worker', 'lib', 'provider-capabilities.ts'))

      const extractData = (content: string) => {
        const start = content.indexOf('export const PROVIDER_CAPABILITIES')
        const end = content.indexOf('\n}\n', start)
        return content.substring(start, end).trim()
      }

      expect(extractData(appFile)).toBe(extractData(workerFile))
    })
  })

  describe('no unjustified `any` in critical domain modules', () => {
    it('publications module files have ≤2 `any` each', () => {
      const files = listTsFiles(join(MODULES_DIR, 'publications'))
      for (const file of files) {
        const content = readFile(file)
        const codeLines = content.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
        const anyCount = (codeLines.join('\n').match(/:\s*any\b/g) || []).length
        expect(anyCount, `${file} has ${anyCount} \`any\` types`).toBeLessThanOrEqual(2)
      }
    })
  })

  describe('route handlers are thin', () => {
    // Issue #156 / #200: All route handlers must be thin (<100 lines).
    // Route handlers should only do: auth → validate → service.method() → response mapping.
    // Business logic belongs in services, data access in repositories.
    const API_DIR = join(SRC_DIR, 'app', 'api')
    const routeFiles = listTsFiles(API_DIR).filter(f => f.endsWith('route.ts'))

    it('route files exist', () => {
      expect(routeFiles.length).toBeGreaterThan(0)
    })

    // Issue #200: grace list is empty — every route must now pass the 100-line limit.
    // The previous 200-line grace branch has been removed.
    const GRACE_LIST: string[] = []

    for (const file of routeFiles) {
      const relPath = file.replace(process.cwd(), '').replace(/\\/g, '/')
      const isGrace = GRACE_LIST.some(g => relPath.includes(`/api/${g}/`))

      it(`${relPath} is under 100 lines${isGrace ? ' (grace — not yet migrated)' : ''}`, () => {
        const content = readFile(file)
        const lines = content.split('\n').length
        expect(lines, `${relPath} has ${lines} lines (limit 100)`).toBeLessThan(100)
      })
    }
  })
})
