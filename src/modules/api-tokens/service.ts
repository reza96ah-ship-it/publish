/**
 * Issue #255: API Tokens domain module — service.
 *
 * Business-logic layer. Follows the smart-pages/service.ts pattern:
 *   - Constructor injects the repository (default = new instance).
 *   - Throws domain errors (ApiTokenError subclasses) — route handler maps
 *     them to HTTP via `instanceof ApiTokenError`.
 *
 * Critical security property: the plaintext token returned by `create` is
 * the ONLY time it is exposed to anyone — including the admin who created
 * it. The hash is persisted; the plaintext is forgotten. If the admin
 * loses it, they must rotate (revoke + create new).
 */

import { generateApiToken } from '@/lib/api-token'
import { ApiTokensRepository } from './repository'
import { ApiTokenNotFoundError, ValidationError } from './errors'
import type {
  ApiTokenItem,
  CreateApiTokenInput,
  CreateApiTokenResult,
} from './types'

export class ApiTokensService {
  constructor(
    private readonly repo: ApiTokensRepository = new ApiTokensRepository()
  ) {}

  /** List all API tokens for the active workspace. */
  async listTokens(workspaceId: string): Promise<ApiTokenItem[]> {
    return this.repo.list(workspaceId)
  }

  /** Alias kept for route-handler brevity (matches `webhooksService.list`). */
  async list(workspaceId: string): Promise<ApiTokenItem[]> {
    return this.listTokens(workspaceId)
  }

  /**
   * Create a new API token. Generates the plaintext + hash, persists only
   * the hash + prefix, and returns both the persisted row and the plaintext
   * (shown to the admin ONCE).
   *
   * Validates that the name is non-empty and at least one scope is present.
   * The Zod schema (apiTokenCreateSchema) already enforces this at the route
   * boundary; the service re-checks so a misbehaving internal caller can't
   * bypass the route layer.
   */
  async createToken(
    workspaceId: string,
    createdById: string,
    input: CreateApiTokenInput
  ): Promise<CreateApiTokenResult> {
    if (!input.name || !input.name.trim()) {
      throw new ValidationError('نام توکن الزامی است')
    }
    if (!input.scopes || input.scopes.length === 0) {
      throw new ValidationError('حداقل یک دسترسی الزامی است')
    }

    const { plaintext, hash, prefix } = generateApiToken()
    // Convert ISO-8601 string (from the Zod schema) to Date; null/undefined
    // both mean "no expiry". Invalid strings would have been rejected by the
    // Zod `.datetime()` validator at the route boundary.
    const expiresAt =
      input.expiresAt && input.expiresAt.trim() !== ''
        ? new Date(input.expiresAt)
        : null
    const token = await this.repo.create(
      workspaceId,
      createdById,
      { name: input.name, scopes: input.scopes, expiresAt },
      hash,
      prefix
    )
    return { token, plaintext }
  }

  /** Alias kept for route-handler brevity (matches `webhooksService.create`). */
  async create(
    workspaceId: string,
    createdById: string,
    input: CreateApiTokenInput
  ): Promise<CreateApiTokenResult> {
    return this.createToken(workspaceId, createdById, input)
  }

  /**
   * Soft-revoke a token (sets revokedAt). The hash is retained for audit.
   * Subsequent requests with this token will be rejected by the auth guard
   * with 401 "توکن باطل شده است".
   */
  async revokeToken(workspaceId: string, id: string): Promise<void> {
    const existing = await this.repo.findByIdInWorkspace(id, workspaceId)
    if (!existing) throw new ApiTokenNotFoundError()
    await this.repo.revoke(id, workspaceId)
  }

  /** Alias kept for route-handler brevity. */
  async revoke(workspaceId: string, id: string): Promise<void> {
    return this.revokeToken(workspaceId, id)
  }

  /**
   * Hard-delete a token. Unlike revoke, this is irreversible and removes
   * the audit trail. Use revoke for normal token lifecycle; reserve delete
   * for GDPR-style erasure requests.
   */
  async deleteToken(workspaceId: string, id: string): Promise<void> {
    const existing = await this.repo.findByIdInWorkspace(id, workspaceId)
    if (!existing) throw new ApiTokenNotFoundError()
    await this.repo.delete(id, workspaceId)
  }

  /** Alias kept for route-handler brevity. */
  async delete(workspaceId: string, id: string): Promise<void> {
    return this.deleteToken(workspaceId, id)
  }
}

export const apiTokensService = new ApiTokensService()
