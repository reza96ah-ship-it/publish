export async function register() {
  // Dynamic imports keep tracing (node:crypto) and the config validator
  // (process.exit) out of the Edge bundle — static imports here made the
  // dev server re-emit Edge-runtime warnings on every request.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const [{ bootstrapServiceConfig }, { initTracing }] = await Promise.all([
      import('../shared/config-validator'),
      import('./lib/tracing'),
    ])
    bootstrapServiceConfig('app')
    initTracing('nashrino-app')
  }
}
