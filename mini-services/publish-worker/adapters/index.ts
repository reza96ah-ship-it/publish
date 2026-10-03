import type { ChannelAdapter, PlatformType } from './types'
import { InstagramAdapter } from './instagram'
import { RubikaAdapter } from './rubika'
import { EitaaAdapter } from './eitaa'
import { TelegramAdapter } from './telegram'
import { LinkedInAdapter } from './linkedin'
import { BaleAdapter } from './bale'
import { ZernioInstagramAdapter } from './zernio-instagram'

const adapters: Record<PlatformType, ChannelAdapter> = {
  instagram: new InstagramAdapter(),
  rubika: new RubikaAdapter(),
  eitaa: new EitaaAdapter(),
  telegram: new TelegramAdapter(),
  linkedin: new LinkedInAdapter(),
  bale: new BaleAdapter(),
}

const zernioInstagram = new ZernioInstagramAdapter()

export function getAdapter(platform: string, provider = 'direct'): ChannelAdapter | null {
  if (platform === 'instagram' && provider === 'zernio') return zernioInstagram
  return adapters[platform as PlatformType] ?? null
}

export { type ChannelAdapter, type PlatformType } from './types'
