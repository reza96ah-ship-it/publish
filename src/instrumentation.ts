import { bootstrapServiceConfig } from '../shared/config-validator'

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    bootstrapServiceConfig('app')
  }
}
