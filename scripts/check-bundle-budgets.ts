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
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import path from 'node:path'

interface BuildManifest {
  pages: Record<string, string[]>
}

function getGzippedSizeKb(files: string[]): number {
  let totalBytes = 0
  for (const file of files) {
    const filePath = path.join('.next', file)
    if (existsSync(filePath)) {
      totalBytes += gzipSync(readFileSync(filePath)).length
    }
  }
  return Math.round(totalBytes / 1024)
}

function getCssSizeKb(): number {
  const cssDir = path.join('.next', 'static', 'css')
  if (!existsSync(cssDir)) return 0
  let totalBytes = 0
  for (const file of readdirSync(cssDir)) {
    if (file.endsWith('.css')) {
      totalBytes += gzipSync(readFileSync(path.join(cssDir, file))).length
    }
  }
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

  console.log('\n=== Bundle Size Report (gzip) ===\n')
  console.log('Route                  | JS Budget | JS Actual | Status')
  console.log('-----------------------|-----------|-----------|--------')

  for (const budget of ROUTE_BUDGETS) {
    const routeFiles = pages[budget.route] || []
    const actualKb = getGzippedSizeKb(routeFiles)
    const status = actualKb <= budget.maxJsKb ? '✅ PASS' : '❌ FAIL'
    const routePadded = budget.route.padEnd(22)
    const budgetPadded = String(budget.maxJsKb).padStart(9)
    const actualPadded = String(actualKb).padStart(9)
    console.log(`${routePadded} | ${budgetPadded} | ${actualPadded} | ${status}`)

    if (actualKb > budget.maxJsKb) {
      failed = true
      console.error(`  ⚠️  ${budget.route} JS exceeds budget by ${actualKb - budget.maxJsKb}KB`)
    }
  }

  // CSS check — Next.js emits a single shared CSS chunk; compare against the
  // tightest per-route CSS budget as a conservative global ceiling.
  const maxCssKb = Math.min(...ROUTE_BUDGETS.map(b => b.maxCssKb))
  const actualCssKb = getCssSizeKb()
  const cssStatus = actualCssKb <= maxCssKb ? '✅ PASS' : '❌ FAIL'
  console.log(`\n=== CSS Budget (gzip) ===`)
  console.log(`Global CSS: ${actualCssKb}KB / ${maxCssKb}KB budget  ${cssStatus}`)
  if (actualCssKb > maxCssKb) {
    failed = true
    console.error(`  ⚠️  CSS bundle exceeds tightest route budget by ${actualCssKb - maxCssKb}KB`)
  }

  // Also report pages not in the budget list
  const budgetRoutes = new Set(ROUTE_BUDGETS.map(b => b.route))
  const unbudgeted = Object.keys(pages).filter(r => !budgetRoutes.has(r) && !r.startsWith('/_'))
  if (unbudgeted.length > 0) {
    console.log('\n⚠️  Routes without budgets (add to ROUTE_BUDGETS):')
    for (const route of unbudgeted.slice(0, 10)) {
      const size = getGzippedSizeKb(pages[route] || [])
      console.log(`  ${route}: ${size}KB (gzip)`)
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
