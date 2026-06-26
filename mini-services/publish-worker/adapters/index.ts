import type { ChannelAdapter, PlatformType } from './types'
import { InstagramAdapter } from './instagram'
import { RubikaAdapter } from './rubika'
import { TelegramAdapter } from './telegram'
import { LinkedInAdapter } from './linkedin'
import { BaleAdapter } from './bale'

const adapters: Record<PlatformType, ChannelAdapter> = {
  instagram: new InstagramAdapter(),
  rubika: new RubikaAdapter(),
  telegram: new TelegramAdapter(),
  linkedin: new LinkedInAdapter(),
  bale: new BaleAdapter(),
  eitaa: new RubikaAdapter(), // Eitaa uses a similar bot API; reuse until dedicated adapter
}

export function getAdapter(platform: string): ChannelAdapter | null {
  return adapters[platform as PlatformType] ?? null
}

export { type ChannelAdapter, type PlatformType } from './types'
