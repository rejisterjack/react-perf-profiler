# Contributing to React Perf Profiler

Thanks for your interest in contributing! This is a Turborepo monorepo. The extension lives in [`apps/ext`](apps/ext) and has its own (more detailed) [`CONTRIBUTING.md`](apps/ext/CONTRIBUTING.md) — read that first if you're touching the extension.

## Repository layout

| Path                         | What                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `apps/ext`                   | WXT browser extension (the core product). See its [`README`](apps/ext/README.md) and [`CONTRIBUTING`](apps/ext/CONTRIBUTING.md). |
| `apps/web`                   | Next.js marketing + API app.                                                                                                     |
| `packages/profile-contract`  | Shared TypeScript types + Zod schemas for the profile data contract.                                                             |
| `packages/eslint-config`     | Shared ESLint configs.                                                                                                           |
| `packages/typescript-config` | Shared `tsconfig.json` presets.                                                                                                  |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [bun](https://bun.sh/) 1.3+ (this repo's package manager)

## Setup

```bash
git clone https://github.com/rejisterjack/react-perf-profiler.git
cd react-perf-profiler
bun install
```

## Common commands

Run from the repo root:

```bash
bun run build          # turbo run build (all apps + packages)
bun run check-types    # turbo run check-types
bun run lint           # turbo run lint
```

Or scope to one workspace:

```bash
cd apps/ext && bun run dev      # extension dev server with HMR
cd apps/web && bun run dev      # web app on http://localhost:7394
```

## Commit conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

type:    feat | fix | chore | docs | refactor | test | perf
scope:   ext | web | contract | ci | docs
subject: imperative, lowercase, no trailing period
```

Examples:

```
feat(web): add /api/auth/refresh endpoint
fix(ext): prevent duplicate COMMIT_BATCH dispatch in content script
docs(contract): document ProfileUploadRequest envelope
```

## Pull requests

- Keep PRs small and focused — one logical change per PR.
- Reference issues in the PR description (`Closes #123`).
- Ensure `bun run lint` and `bun run check-types` pass before requesting review.
- The PR template (`.github/pull_request_template.md`) lists the checklist.

## Reporting bugs

Use the issue templates in `.github/ISSUE_TEMPLATE/`. Include:

- React version of the target app
- Extension version (from `chrome://extensions`)
- Browser and OS
- Steps to reproduce
- Expected vs actual behavior
- (Optional) exported profile JSON

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
