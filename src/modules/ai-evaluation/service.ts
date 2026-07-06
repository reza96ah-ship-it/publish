/**
 * Issue #252: AI evaluation harness — service.
 *
 * Business-logic layer. Calls the existing /api/ai/caption route via fetch
 * (server-side, internal — preserves the SSE→buffered-text contract). Each
 * prompt produces one EvaluationResult row (in-memory); a reviewer can then
 * attach a score (1–5) + free-form Persian feedback.
 *
 * The fetch is relative to the current deployment origin — we use
 * `process.env.NEXT_PUBLIC_APP_URL` (fallback: http://localhost:3000) so
 * the call works in both dev and prod.
 */

import { randomUUID } from 'crypto'
import { AIEvaluationRepository } from './repository'
import {
  EvaluationSetNotFoundError,
  EvaluationResultNotFoundError,
  ValidationError,
  CaptionGenerationError,
} from './errors'
import type {
  AuthContext,
  EvaluationSet,
  EvaluationResult,
  CreateSetInput,
  RunEvaluationInput,
  SubmitFeedbackInput,
} from './types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export class AIEvaluationService {
  constructor(private readonly repo: AIEvaluationRepository = new AIEvaluationRepository()) {}

  listSets(_auth: AuthContext): EvaluationSet[] {
    return this.repo.listSets()
  }

  getSet(_auth: AuthContext, id: string): EvaluationSet {
    const set = this.repo.getSet(id)
    if (!set) throw new EvaluationSetNotFoundError()
    return set
  }

  createSet(_auth: AuthContext, input: CreateSetInput): EvaluationSet {
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('نام مجموعه الزامی است')
    }
    if (!Array.isArray(input.prompts) || input.prompts.length === 0) {
      throw new ValidationError('حداقل یک پرامپت الزامی است')
    }
    const set: EvaluationSet = {
      id: `set-${randomUUID().slice(0, 8)}`,
      name: input.name.trim(),
      tone: input.tone,
      prompts: input.prompts,
      createdAt: new Date().toISOString(),
    }
    this.repo.saveSet(set)
    return set
  }

  deleteSet(_auth: AuthContext, id: string): void {
    if (!this.repo.deleteSet(id)) throw new EvaluationSetNotFoundError()
  }

  /**
   * Run the caption generation pipeline for each prompt in the set.
   * Calls POST /api/ai/caption internally (SSE-streamed — we buffer the
   * final text out of the stream). Returns the newly-created results.
   */
  async runEvaluation(
    auth: AuthContext,
    id: string,
    input: RunEvaluationInput = {}
  ): Promise<EvaluationResult[]> {
    const set = this.getSet(auth, id)
    const indices = input.indices ?? set.prompts.map((_, i) => i)
    const created: EvaluationResult[] = []
    for (const idx of indices) {
      const seed = set.prompts[idx]
      if (!seed) throw new ValidationError(`اندیس پرامپت نامعتبر: ${idx}`)
      const generatedContent = await this.callCaptionAPI(auth, seed.prompt, seed.platform, seed.tone)
      const result: EvaluationResult = {
        id: `res-${randomUUID().slice(0, 12)}`,
        setId: id,
        promptIndex: idx,
        prompt: seed.prompt,
        generatedContent,
        score: 0,
        feedback: null,
        createdAt: new Date().toISOString(),
        reviewedAt: null,
      }
      this.repo.saveResult(result)
      created.push(result)
    }
    return created
  }

  listResults(auth: AuthContext, setId: string): EvaluationResult[] {
    // Verify the set exists (404 if not) before listing its results.
    this.getSet(auth, setId)
    return this.repo.listResults(setId)
  }

  submitFeedback(
    auth: AuthContext,
    resultId: string,
    input: SubmitFeedbackInput
  ): EvaluationResult {
    const result = this.repo.getResult(resultId)
    if (!result) throw new EvaluationResultNotFoundError()
    // Verify the result's set still exists.
    this.getSet(auth, result.setId)
    if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5) {
      throw new ValidationError('امتیاز باید عددی بین ۱ تا ۵ باشد')
    }
    const updated: EvaluationResult = {
      ...result,
      score: input.score,
      feedback: input.feedback?.trim() || null,
      reviewedAt: new Date().toISOString(),
    }
    this.repo.saveResult(updated)
    return updated
  }

  /**
   * Internal helper: call /api/ai/caption and return the generated text.
   * The caption route streams SSE; we read the body as text and extract the
   * last `data:` line that contains the final caption payload.
   */
  private async callCaptionAPI(
    auth: AuthContext,
    topic: string,
    platform: string,
    tone: string
  ): Promise<string> {
    let res: Response
    try {
      res = await fetch(`${APP_URL}/api/ai/caption?workspaceId=${encodeURIComponent(auth.workspaceId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, platform: platform as 'instagram' | 'telegram', tone: tone as 'formal' | 'friendly' | 'promotional' | 'support' | 'professional' }),
      })
    } catch (err) {
      throw new CaptionGenerationError(err instanceof Error ? err.message : 'خطای شبکه')
    }
    if (!res.ok || !res.body) {
      throw new CaptionGenerationError(`HTTP ${res.status}`)
    }
    const text = await res.text()
    // Caption route streams SSE events; the final payload is on the last data: line.
    const lines = text.split('\n').filter((l) => l.startsWith('data:'))
    if (lines.length === 0) return text.trim()
    try {
      const last = JSON.parse(lines[lines.length - 1].replace(/^data:\s*/, ''))
      return typeof last === 'string' ? last : (last.caption ?? last.text ?? JSON.stringify(last))
    } catch {
      return lines[lines.length - 1].replace(/^data:\s*/, '')
    }
  }
}

export const aiEvaluationService = new AIEvaluationService()
