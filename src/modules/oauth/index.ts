/**
 * Issue #200: OAuth domain module — public API.
 *
 * Re-exports the service + types so route handlers can import from a single
 * entry point: `import { oauthService } from '@/modules/oauth'`
 */

export { OAuthService, oauthService } from './service'
export type {
  StartOAuthInput,
  StartOAuthResult,
  StartOAuthSuccess,
  StartOAuthError,
  CallbackInput,
  CallbackResult,
} from './types'
