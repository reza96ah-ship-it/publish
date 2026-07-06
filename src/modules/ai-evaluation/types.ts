/**
 * Issue #252: AI evaluation harness — types.
 *
 * An EvaluationSet bundles a list of Persian prompts that share a tone
 * (formal / friendly / promotional / support / professional). Running an
 * evaluation set calls the existing /api/ai/caption route once per prompt,
 * captures the generated content, and lets a human reviewer attach a score
 * (1–5) + free-form feedback. Used for regression-testing prompt changes
 * before shipping them to production captions.
 *
 * Storage is in-memory (per-process Map). The evaluation harness is a
 * developer tool, not a customer-facing feature — persistence isn't needed.
 */

export interface AuthContext {
  workspaceId: string
  userId: string
}

export type EvaluationTone =
  | 'formal'
  | 'friendly'
  | 'promotional'
  | 'support'
  | 'professional'

export interface SeedPrompt {
  prompt: string
  platform: 'instagram' | 'telegram'
  tone: EvaluationTone
}

export interface EvaluationSet {
  id: string
  name: string
  tone: EvaluationTone
  prompts: SeedPrompt[]
  createdAt: string
}

export interface EvaluationResult {
  id: string
  setId: string
  promptIndex: number
  prompt: string
  generatedContent: string
  /** Human-reviewer score 1–5 (0 = not yet reviewed). */
  score: number
  feedback: string | null
  createdAt: string
  reviewedAt: string | null
}

// ── Service inputs ───────────────────────────────────────────────────────────

export interface CreateSetInput {
  name: string
  tone: EvaluationTone
  prompts: SeedPrompt[]
}

export interface RunEvaluationInput {
  /** Optional subset of prompt indices to run (default: all). */
  indices?: number[]
}

export interface SubmitFeedbackInput {
  score: number // 1–5
  feedback?: string
}
