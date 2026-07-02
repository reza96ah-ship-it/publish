import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // ── TypeScript rules ──────────────────────────────────────
      // "warn" = visible in CI but doesn't fail the build.
      // "error" = fails the build (only for clear bugs).
      '@typescript-eslint/no-explicit-any': 'warn', // global default; overridden to error for API/lib below
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/no-unused-disable-directive': 'off',

      // ── React rules ───────────────────────────────────────────
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/purity': 'off',
      // Persian text has many quotes/apostrophes — would generate noise
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',
      'react/prop-types': 'off',
      'react-compiler/react-compiler': 'off',

      // ── Next.js rules ─────────────────────────────────────────
      // We use <img> for thumbnails/platform icons in many places
      '@next/next/no-img-element': 'off',
      '@next/next/no-html-link-for-pages': 'off',

      // ── General JavaScript rules ──────────────────────────────
      'prefer-const': 'warn',
      'no-unused-vars': 'off', // handled by @typescript-eslint/no-unused-vars
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-empty': 'warn',
      'no-irregular-whitespace': 'off', // Persian/RTL text false positives
      'no-case-declarations': 'warn',
      'no-fallthrough': 'error',
      'no-mixed-spaces-and-tabs': 'warn', // don't block CI on whitespace
      'no-redeclare': 'error',
      'no-undef': 'off', // TypeScript handles this; false positives with React 19 JSX
      'no-unreachable': 'error',
      'no-useless-escape': 'warn',
    },
  },
  // Enforce no-any as a build error in security-critical paths (API routes + shared lib).
  // Components and UI files keep the global 'warn' — Framer Motion spreads and catch
  // blocks there are low-risk and would generate unactionable noise.
  {
    files: ['src/app/api/**/*.ts', 'src/lib/**/*.ts', 'shared/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'examples/**',
      'skills/**',
      'mini-services/publish-worker/**', // separate bun project with its own lint
    ],
  },
]

export default eslintConfig
