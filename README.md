# ⚠️ This project is deprecated

**`react-perf-profiler` has been merged into [`frontend-dev-helper`](https://github.com/rejisterjack/frontend-dev-helper).**

All React profiling capabilities from this extension — wasted-render detection, memoization scoring, render-cause attribution, CPU Profile export, flamegraphs, timelines, the component tree, Web Vitals, profile comparison, and AI-powered optimization suggestions — now live in **`frontend-dev-helper`** as a dedicated **React Profiler** tab inside its DevTools panel.

This repository is preserved for historical reference and is no longer maintained. No new features, bug fixes, or releases will happen here. Please switch to `frontend-dev-helper` for all React profiling work.

---

## Why the merge?

`frontend-dev-helper` is a Chrome DevTools extension built on the same stack (WXT + React 19 + shadcn/ui + Zustand + Tailwind v4) and already ships performance, accessibility, and design-system tooling. Maintaining two separate extensions — and two MAIN-world fiber bridges, two analyzer packages, two AI integrations — duplicated a lot of effort. Consolidating into one extension gives you a single DevTools panel that does everything.

---

## Where each feature went

| `react-perf-profiler`                                                        | `frontend-dev-helper`                                                                                                            |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `apps/ext/packages/analyzer` (pure analysis)                                 | `packages/profiler-analyzer`                                                                                                     |
| `packages/profile-contract` (types + Zod schemas)                            | `packages/profiler-contract`                                                                                                     |
| MAIN-world fiber bridge (`bridge.content/`)                                  | `apps/ext/entrypoints/profiler-bridge.content/`                                                                                  |
| `onCommitFiberRoot` monkey-patch + batching                                  | Same pipeline, routed through FDH's existing content script + background service worker                                          |
| `analysisWorker.ts` + `analysisWorkerManager.ts`                             | `apps/ext/lib/profiler/`                                                                                                         |
| `cpuProfileExport.ts`                                                        | `apps/ext/lib/profiler/cpuProfileExport.ts`                                                                                      |
| `patchGenerator.ts` + `AISuggestionsPanel.tsx`                               | `apps/ext/lib/profiler/ai/` + `apps/ext/components/profiler/analysis/AISuggestionsPanel.tsx`                                     |
| `claudeProvider` / `openaiProvider` / `ollamaProvider`                       | **Removed** — reuses FDH's existing `lib/llm-service.ts` (OpenRouter / Ollama / Fireworks / ZAI) and global Settings → AI config |
| Tree, Flamegraph, Timeline, Analysis, WebVitals, Compare, Dependencies views | `apps/ext/components/profiler/`                                                                                                  |
| Session persistence, JSON export, keyboard shortcuts                         | `apps/ext/hooks/profiler/`                                                                                                       |
| "Open in Editor" via `vscode://` / `cursor://` URL hacks                     | "Apply in VS Code" via FDH's authenticated WebSocket bridge (`PreviewFix` message)                                               |

---

## Switch to `frontend-dev-helper`

### Option A — Build from source (load unpacked)

```bash
git clone https://github.com/rejisterjack/frontend-dev-helper.git
cd frontend-dev-helper
bun install
bun run build      # builds the extension to apps/ext/.output/
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select `frontend-dev-helper/apps/ext/.output/chrome-mv3-devtools-panel/`
5. Open DevTools → you'll see the **Frontend Dev Helper** panel with a **React Profiler** tab inside it.

### Option B — Published build

Once `frontend-dev-helper` is published to the Chrome Web Store, search for it there. (This README will be updated with the store link at that time.)

---

## A note on dev-only React builds

The React Profiler hooks into `window.__REACT_DEVTOOLS_GLOBAL_HOOK__`, which **only exists when React runs in development mode**. Production builds of React strip this hook, so production sites cannot be profiled. This is a fundamental limitation of fiber-hooking — not specific to the merge — and is surfaced in the new panel's welcome screen.

---

## Thanks

Thank you to everyone who used, contributed to, and filed issues against `react-perf-profiler`. The work continues at [`frontend-dev-helper`](https://github.com/rejisterjack/frontend-dev-helper).
