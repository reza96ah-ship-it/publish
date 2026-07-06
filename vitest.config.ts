import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.tsx'],
    // Issue #153: unit + contract tests in default run
    // Integration tests (DB/Redis) run separately via test:integration
    include: [
      'tests/unit/**/*.test.{ts,tsx}',
      'tests/contract/**/*.test.{ts,tsx}',
    ],
    // Exclude integration/chaos from default run (they need real services)
    exclude: [
      'tests/integration/**',
      'tests/chaos/**',
      'tests/e2e/**',
      'node_modules/**',
    ],
  },
  // Override the project's postcss.config.mjs (Tailwind v4 plugin) which Vite
  // cannot load as a string — tests don't need CSS processing anyway.
  css: {
    postcss: { plugins: [] },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
