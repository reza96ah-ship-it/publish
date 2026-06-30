/**
 * Issue #144: Provider auth adapter registry.
 *
 * Registers all adapters and provides a single lookup function.
 * The connect route uses this to validate credentials for any provider type.
 */

import { registerProviderAuthAdapter, getProviderAuthAdapter } from './types'
import { TelegramAuthAdapter, BaleAuthAdapter, RubikaAuthAdapter } from './bot-token-adapters'
import { InstagramAuthAdapter, LinkedInAuthAdapter } from './oauth-adapters'

// Register all adapters (runs once on module load)
let registered = false
function registerAll(): void {
  if (registered) return
  registerProviderAuthAdapter(new TelegramAuthAdapter())
  registerProviderAuthAdapter(new BaleAuthAdapter())
  registerProviderAuthAdapter(new RubikaAuthAdapter())
  registerProviderAuthAdapter(new InstagramAuthAdapter())
  registerProviderAuthAdapter(new LinkedInAuthAdapter())
  // Eitaa uses Rubika adapter (same API)
  registerProviderAuthAdapter(new RubikaAuthAdapter()) // registered as 'rubika', eitaa uses same
  registered = true
}

registerAll()

export { getProviderAuthAdapter }
export type { ProviderAuthAdapter, ProviderCredential, CredentialHealth } from './types'
