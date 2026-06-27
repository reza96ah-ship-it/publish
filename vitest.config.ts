import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.tsx'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
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
