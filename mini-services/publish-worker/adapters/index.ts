import type { ChannelAdapter, PlatformType } from './types'
import { InstagramAdapter } from './instagram'
import { RubikaAdapter } from './rubika'
import { EitaaAdapter } from './eitaa'
import { TelegramAdapter } from './telegram'
import { LinkedInAdapter } from './linkedin'
import { BaleAdapter } from './bale'

const adapters: Record<PlatformType, ChannelAdapter> = {
  instagram: new InstagramAdapter(),
  rubika: new RubikaAdapter(),
  eitaa: new EitaaAdapter(),
  telegram: new TelegramAdapter(),
  linkedin: new LinkedInAdapter(),
  bale: new BaleAdapter(),
}

export function getAdapter(platform: string): ChannelAdapter | null {
  return adapters[platform as PlatformType] ?? null
}

export { type ChannelAdapter, type PlatformType } from './types'
