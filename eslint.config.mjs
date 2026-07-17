import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // ── TypeScript rules ──────────────────────────────────────
      // "warn" = visible in CI but doesn't fail the build.
      // "error" = fails the build (only for clear bugs).
      '@typescript-eslint/no-explicit-any': 'warn', // global default; overridden to error for API/lib below
      '@typescript-eslint/no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/no-unused-disable-directive': 'off',

      // ── React rules ───────────────────────────────────────────
      'react-hooks/exhaustive-deps': 'warn',
      // React Compiler rules added in eslint-plugin-react-hooks@7 — off until we opt in
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/component-hook-factories': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/config': 'off',
      'react-hooks/gating': 'off',
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
  // Test files: any/!, console, and unused vars are normal in test code
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx', 'tests/**/*.js'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'import/no-anonymous-default-export': 'off',
      'no-useless-escape': 'off',
    },
  },
  // CLI scripts, seed files, shared lib: console output is intentional
  {
    files: ['scripts/**/*.ts', 'prisma/**/*.ts', 'shared/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.claude/**', // Claude Code session artifacts (worktrees, caches)
      'out/**',
      'build/**',
      'tmp-visual-report/**',
      'next-env.d.ts',
      'examples/**',
      'skills/**',
      'k6/**', // k6 load test scripts — separate runtime with its own globals
      'mini-services/**', // separate bun projects with their own lint configs
      'login ui/**', // experimental UI sandbox — not part of the main app
    ],
  },
]

export default eslintConfig
