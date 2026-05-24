# CLAUDE.md — Project Rules

## Design System

- Always use the **default shadcn/ui design system** (Nova style, radix primitives). Do not override or customize shadcn component styles beyond what Tailwind utility classes provide within the component files.
- **Only use shadcn/ui components** for all UI elements. No custom-built components where a shadcn equivalent exists.
- Keep the default shadcn styling — do not alter the generated component files in `components/ui/`.
- Install all UI components **exclusively via the shadcn CLI**:
  ```
  npx shadcn@latest add <component>
  ```
  Never manually create components that shadcn provides (button, card, dialog, input, etc.).

## Tech Stack

- **Framework**: WXT (Web Extension Tools) with React
- **UI**: shadcn/ui + Tailwind CSS v4
- **Styling**: Tailwind utility classes only. No inline styles for layout/spacing — use Tailwind classes.
- **Package Manager**: bun
- **Tailwind Plugin**: `@tailwindcss/vite` must be registered in `wxt.config.ts` as a Vite plugin.

## File Conventions

- Entry points live in `entrypoints/` (popup, background, content scripts).
- shadcn components live in `components/ui/` — installed via CLI, do not hand-edit.
- CSS theme variables are in `src/index.css` — managed by shadcn, do not override defaults.
- Path alias `@/` maps to project root.
