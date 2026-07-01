import { nextJsConfig } from '@repo/eslint-config/next-js';

/**
 * ESLint config for apps/web (Next.js 15 marketing + API app).
 *
 * This replaces the previous Biome setup so the entire monorepo uses one
 * linter (@repo/eslint-config).
 */
export default [
  ...nextJsConfig,
  {
    ignores: [
      '.next/**',
      'out/**',
      'node_modules/**',
      'public/**',
      // Scripts and seeds are not part of the shipped bundle.
      'scripts/**',
      'prisma/**',
      // E2E tests use their own tsconfig and Playwright globals.
      'e2e/**',
      'playwright.config.ts',
    ],
  },
];
