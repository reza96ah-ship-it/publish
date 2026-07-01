import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/**
 * Issue #153: Integration test config.
 *
 * Runs against real PostgreSQL + Redis (not mocked).
 * Used by: bun run test:integration
 *
 * CI runs this job separately with PG + Redis services.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node', // Integration tests don't need jsdom
    globals: true,
    include: [
      'tests/integration/**/*.test.{ts,tsx}',
      'tests/chaos/**/*.test.{ts,tsx}',
    ],
    // Longer timeout for real DB/Redis operations
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
