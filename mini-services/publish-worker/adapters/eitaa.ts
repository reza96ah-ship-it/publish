/**
 * Eitaa Bot API adapter.
 *
 * Eitaa is an Iranian messaging platform with a bot API compatible with Rubika's
 * API shape. Base URL: https://eitaayar.ir/api/{token}/{method} (POST).
 *
 * Extends RubikaAdapter — same API contract, different base URL and labels.
 */

import { RubikaAdapter } from './rubika'
import type { PlatformType } from './types'

const EITAA_API_BASE = 'https://eitaayar.ir/api'

export class EitaaAdapter extends RubikaAdapter {
  override readonly platform: PlatformType = 'eitaa'
  protected override readonly apiBase: string = EITAA_API_BASE
  protected override readonly platformLabel: string = 'ایتا'
}
