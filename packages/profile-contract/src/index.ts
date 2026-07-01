/**
 * Public entry point of @repo/profile-contract.
 *
 * Re-exports the canonical TypeScript types. Zod schemas live in
 * `@repo/profile-contract/schema` to keep the type-only import path free of
 * the `zod` runtime dependency for consumers that only need types.
 *
 * The HTTP client (`ProfileClient`) is exported from
 * `@repo/profile-contract/client` to keep its `fetch` dependency out of
 * pure-type consumers.
 */

export * from './types.js';
