# Changesets

This repo uses [Changesets](https://github.com/changesets/changesets) to manage
versions and changelogs for the published packages:

- `@react-perf-profiler/analyzer` — `apps/ext/packages/analyzer`
- `@react-perf-profiler/cli` — `apps/ext/packages/cli`
- `@react-perf-profiler/vscode-extension` — `apps/ext/packages/vscode-extension`
- `@react-perf-profiler/test-plugin` — `apps/ext/packages/test-plugin`

(The extension itself, the web app, and the shared `@repo/*` packages are all
`"private": true"` and are not published — they're versioned by Git tags and
deployed via CI.)

## Workflow

1. While working on a PR that changes a published package, run:

   ```bash
   bun run changeset
   ```

   Answer the prompts to declare a `major` / `minor` / `patch` bump and write
   a user-facing changelog entry. A markdown file appears under `.changeset/`.

2. Commit the changeset alongside your code changes.

3. When the PR is merged, a Changesets GitHub Action (added in a follow-up)
   opens a "Version Packages" PR that consumes all pending changesets and
   bumps `package.json` + `CHANGELOG.md` for the affected packages.

4. Merging the Version Packages PR publishes to npm.

## Private packages

The following workspace packages are intentionally excluded from publishing
(set in `.changeset/config.json` under `ignore`):

- `react-perf-profiler` (the extension — distributed via the Web Store)
- `web` (the Next.js app — deployed to Vercel)
- `@repo/profile-contract`, `@repo/eslint-config`, `@repo/typescript-config`
  (internal-only — never published)
