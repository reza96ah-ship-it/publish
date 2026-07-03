#!/usr/bin/env bun
/**
 * CI guard: reject fixture domains, demo identities, and placeholder data
 * from production component render paths.
 *
 * Exit 1 if violations found, 0 if clean.
 * Run: bun run scripts/check-fixture-data.ts
 */

import { readdir, readFile } from 'fs/promises'
import path from 'path'

// Patterns that must NOT appear in production source (src/) components
const FORBIDDEN = [
  // Placeholder avatar services
  { pattern: /pravatar\.cc/g, label: 'pravatar.cc placeholder avatar' },
  { pattern: /ui-avatars\.com/g, label: 'ui-avatars.com placeholder avatar' },
  { pattern: /randomuser\.me/g, label: 'randomuser.me fixture avatar' },
  { pattern: /dicebear\.com/g, label: 'dicebear.com fixture avatar' },
  { pattern: /picsum\.photos/g, label: 'picsum.photos placeholder image' },
  { pattern: /placehold\.co/g, label: 'placehold.co placeholder image' },
  { pattern: /lorempixel\.com/g, label: 'lorempixel placeholder image' },

  // Demo/fixture user names (Persian)
  { pattern: /علی احمدی/g, label: 'hard-coded demo user name (علی احمدی)' },
  { pattern: /برند آرامش/g, label: 'hard-coded demo workspace name (برند آرامش)' },

  // Demo/fixture metrics
  { pattern: /lorem ipsum/gi, label: 'lorem ipsum placeholder text' },

  // Explicit fixture/demo markers in JSX strings (not comments)
  // Matches: "TODO: wire up" or "// TODO" only in JSX/TSX string literals
]

// Files/directories to exclude from scanning
const EXCLUDE = [
  'node_modules',
  '.next',
  '.git',
  'dist',
  'prisma/seed',
  'tests/',
  'scripts/',
  '__tests__',
  '.test.',
  '.spec.',
  'stories/',
  '.story.',
]

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (EXCLUDE.some((ex) => full.includes(ex))) continue
    if (entry.isDirectory()) {
      yield* walk(full)
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      yield full
    }
  }
}

async function main() {
  const root = path.resolve(import.meta.dir, '..')
  const srcDir = path.join(root, 'src')

  const violations: { file: string; line: number; label: string; text: string }[] = []

  for await (const file of walk(srcDir)) {
    const rel = path.relative(root, file)
    const content = await readFile(file, 'utf-8')
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Skip comment-only lines
      if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue

      for (const { pattern, label } of FORBIDDEN) {
        if (pattern.test(line)) {
          violations.push({ file: rel, line: i + 1, label, text: line.trim() })
        }
        pattern.lastIndex = 0 // reset global regex
      }
    }
  }

  if (violations.length === 0) {
    console.log('✅  No fixture data found in production components.')
    process.exit(0)
  }

  console.error(`❌  Found ${violations.length} fixture data violation(s):\n`)
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} — ${v.label}`)
    console.error(`    ${v.text}\n`)
  }
  process.exit(1)
}

main()
