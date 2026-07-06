/**
 * Issue #252: AI evaluation harness — in-memory repository.
 *
 * The evaluation harness is a developer tool (not customer-facing), so we
 * store sets + results in per-process Maps. The architecture test enforces
 * that "db imported ONLY in repository.ts" — for this module, the
 * repository simply doesn't import `db` at all (no persistence needed).
 *
 * On first use the repo is pre-seeded with the 5 canonical Persian prompt
 * sets from ./seed-evaluation-set.ts.
 */

import { SEED_EVALUATION_SETS } from './seed-evaluation-set'
import type { EvaluationSet, EvaluationResult } from './types'

const sets = new Map<string, EvaluationSet>()
const results = new Map<string, EvaluationResult>()
let seeded = false

function ensureSeeded(): void {
  if (seeded) return
  for (const set of SEED_EVALUATION_SETS) sets.set(set.id, set)
  seeded = true
}

export class AIEvaluationRepository {
  listSets(): EvaluationSet[] {
    ensureSeeded()
    return Array.from(sets.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  getSet(id: string): EvaluationSet | null {
    ensureSeeded()
    return sets.get(id) ?? null
  }

  saveSet(set: EvaluationSet): void {
    ensureSeeded()
    sets.set(set.id, set)
  }

  deleteSet(id: string): boolean {
    ensureSeeded()
    // Cascade: delete all results for this set.
    for (const r of results.values()) {
      if (r.setId === id) results.delete(r.id)
    }
    return sets.delete(id)
  }

  listResults(setId: string): EvaluationResult[] {
    return Array.from(results.values())
      .filter((r) => r.setId === setId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  getResult(id: string): EvaluationResult | null {
    return results.get(id) ?? null
  }

  saveResult(result: EvaluationResult): void {
    results.set(result.id, result)
  }
}
