# Post-Launch Roadmap: PWA + Horizontal Scaling + React Native

**Status:** Tracking issue (#72) — no implementation yet
**Priority:** Post-launch (when DAU > 100 for PWA, DAU > 500 for React Native)

## PWA — Offline Support (Phase 3 post-launch)

### Tasks
- [ ] Add `next-pwa` or manual service worker for offline Compose draft support
- [ ] Add `manifest.json` with Persian app name + RTL display
- [ ] Cache API responses for offline inbox viewing
- [ ] Add install prompt on mobile (beforeinstallprompt event)
- [ ] Add offline indicator in the UI (connection status)

### Benefits for Iranian market
- App Store / Play Store access is restricted in Iran
- PWA installable from browser — no store needed
- Offline draft support — users can compose without internet
- Push notifications via service worker

### Technical approach
```ts
// next.config.ts
import withPWA from 'next-pwa'
export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    { urlPattern: '/api/inbox', handler: 'NetworkFirst', options: { cacheName: 'inbox' } },
    { urlPattern: '/api/content', handler: 'StaleWhileRevalidate' },
  ],
})(nextConfig)
```

## Horizontal Scaling (when traffic requires > 1 app instance)

### Tasks
- [ ] Add a second VPS node to `compose.production.yaml`
- [ ] Add Nginx/Caddy upstream block for load balancing
- [ ] Verify Socket.io still works (Redis adapter already in place from Phase 7)
- [ ] Add health check endpoint to Nginx (`/api/readyz`)
- [ ] Configure sticky sessions for Socket.io (or rely on Redis adapter for multi-node)

### Current scaling readiness
- ✅ Redis adapter for Socket.io (Phase 7) — supports multiple realtime instances
- ✅ BullMQ queue (Sprint B) — worker can scale to multiple instances
- ✅ Health endpoints (`/api/health`, `/api/readyz`) — for load balancer probes
- ✅ PgBouncer connection pooling — prevents connection exhaustion with multiple app instances
- ✅ Stateless JWT sessions — no server-side session store needed

### What's needed
- [ ] Load balancer config (Caddy upstream or Nginx)
- [ ] Session affinity for WebSocket upgrade (Socket.io initial handshake)
- [ ] Shared file storage (S3 already in place — no local disk dependency)

## React Native Companion (when DAU > 500)

### Evaluation
- [ ] Evaluate Expo + React Native for approve/inbox mobile flows
- [ ] Share Zod validation schemas between web and native
- [ ] Consider PWA first — better for Iranian market (store access constraints)

### Recommended approach
1. **Phase 1:** PWA with offline support (covers 80% of mobile use cases)
2. **Phase 2:** React Native for push notifications + camera access (if needed)
3. **Phase 3:** Share API contracts (Zod schemas) between web and native

### Shared code potential
- `src/lib/validations.ts` — Zod schemas (importable in React Native)
- `src/lib/jalali.ts` — Jalali date conversion (pure TS, no DOM dependency)
- API contract types — can be extracted to a shared package
