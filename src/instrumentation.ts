import { bootstrapServiceConfig } from '../shared/config-validator'
import { initTracing } from './lib/tracing'

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    bootstrapServiceConfig('app')
    initTracing('nashrino-app')
  }
}
