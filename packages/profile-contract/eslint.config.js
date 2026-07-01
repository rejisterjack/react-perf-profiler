import { config as baseConfig } from '@repo/eslint-config/base';

/**
 * ESLint config for @repo/profile-contract.
 *
 * Pure TypeScript types and Zod schemas — no React, no Next, no DOM.
 */
export default [
  ...baseConfig,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
