# Contributing

Thanks for helping improve React Perf Profiler.

## Prerequisites

- Node.js 18+
- [bun](https://bun.sh/) 1.x

## Setup

```bash
bun install
bun run dev
```

Load `.output/chrome-mv3/` as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked).

## Commands

| Command | Purpose |
|--------|---------|
| `bun run dev` | Start dev server with HMR |
| `bun run build` | Production build |
| `bun run build:firefox` | Firefox build |
| `bun run compile` | TypeScript type check |
| `bun run zip` | Package for distribution |

## Project structure

```
entrypoints/
  background.ts          Service worker
  content.ts             Content script (ISOLATED world)
  bridge.content/        Content script (MAIN world) — hooks React Fiber
  devtools/              DevTools page registration
  devtools-panel/        DevTools panel UI (React app)
  popup/                 Extension popup
src/
  shared/                Types, constants, messaging, logger
  background/            Background helpers
  panel/
    stores/              Zustand stores
    components/          UI components (shadcn/ui based)
    hooks/               React hooks
    utils/               Utilities (circular buffer, analysis, etc.)
    ai/                  AI provider integrations
    cloud/               Cloud sync providers
    ml/                  TensorFlow.js prediction model
    plugins/             Plugin system
components/ui/           shadcn/ui components (installed via CLI — do not edit)
```

## Design system

- **shadcn/ui only** — all UI uses shadcn components installed via `npx shadcn@latest add <component>`.
- **Tailwind CSS v4** — styling via utility classes only. No inline styles or CSS modules.
- Do not modify files in `components/ui/` — they are managed by the shadcn CLI.

## Pull requests

1. Keep changes focused on one concern when possible.
2. Run `bun run compile` before pushing.
3. If you change user-visible behavior, update relevant docs.

## Security

Do not open public issues for security vulnerabilities. See [SECURITY.md](./SECURITY.md).
