#!/usr/bin/env bun
/**
 * Issue #157: CI bundle budget enforcement.
 *
 * Checks the Next.js build output against ROUTE_BUDGETS.
 * Fails CI if any route exceeds its JS budget.
 *
 * Usage: bun run scripts/check-bundle-budgets.ts
 */

import { ROUTE_BUDGETS } from '../src/lib/performance-budgets'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

interface BuildManifest {
  pages: Record<string, string[]>
}

function getBundleSizeKb(files: string[]): number {
  let totalBytes = 0
  for (const file of files) {
    const filePath = path.join('.next', file)
    if (existsSync(filePath)) {
      const stat = readFileSync(filePath)
      totalBytes += stat.length
    }
  }
  // Convert to KB (uncompressed — gzip would be ~30% smaller)
  return Math.round(totalBytes / 1024)
}

function main() {
  const manifestPath = '.next/build-manifest.json'
  if (!existsSync(manifestPath)) {
    console.error(`Build manifest not found at ${manifestPath}`)
    console.error('Run `bun run build` first.')
    process.exit(1)
  }

  const manifest: BuildManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  const pages = manifest.pages || {}
  let failed = false

  console.log('\n=== Bundle Size Report ===\n')
  console.log('Route                  | Budget KB | Actual KB | Status')
  console.log('-----------------------|-----------|-----------|--------')

  for (const budget of ROUTE_BUDGETS) {
    const routeFiles = pages[budget.route] || []
    const actualKb = getBundleSizeKb(routeFiles)
    const status = actualKb <= budget.maxJsKb ? '✅ PASS' : '❌ FAIL'
    const routePadded = budget.route.padEnd(22)
    const budgetPadded = String(budget.maxJsKb).padStart(9)
    const actualPadded = String(actualKb).padStart(9)
    console.log(`${routePadded} | ${budgetPadded} | ${actualPadded} | ${status}`)

    if (actualKb > budget.maxJsKb) {
      failed = true
      console.error(`  ⚠️  ${budget.route} exceeds budget by ${actualKb - budget.maxJsKb}KB`)
    }
  }

  // Also check pages not in the budget list
  const budgetRoutes = new Set(ROUTE_BUDGETS.map(b => b.route))
  const unbudgeted = Object.keys(pages).filter(r => !budgetRoutes.has(r) && !r.startsWith('/_'))
  if (unbudgeted.length > 0) {
    console.log('\n⚠️  Routes without budgets (add to ROUTE_BUDGETS):')
    for (const route of unbudgeted.slice(0, 10)) {
      const files = pages[route] || []
      const size = getBundleSizeKb(files)
      console.log(`  ${route}: ${size}KB`)
    }
  }

  if (failed) {
    console.error('\n❌ Bundle budget check FAILED — reduce bundle sizes or adjust budgets.')
    process.exit(1)
  } else {
    console.log('\n✅ All bundle budgets passed.')
  }
}

main()
