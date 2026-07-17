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

    // Route all server-side fetch() calls through an outbound HTTP/SOCKS5 proxy
    // when HTTPS_PROXY is set. Required when the server is in a region where
    // Meta/Instagram APIs (api.instagram.com, graph.instagram.com) are blocked.
    // Set HTTPS_PROXY=http://127.0.0.1:7890 in .env.production and run Xray
    // (or any HTTP proxy) on the server listening on that port.
    const proxyUrl = process.env.HTTPS_PROXY
    if (proxyUrl) {
      const { ProxyAgent, setGlobalDispatcher } = await import('undici')
      setGlobalDispatcher(new ProxyAgent(proxyUrl))
      console.info(`[proxy] outbound fetch routed through ${proxyUrl}`)
    }
  }
}
