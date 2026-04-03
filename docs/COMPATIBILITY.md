# Compatibility matrix

The extension interacts with **React** and the **React DevTools hook** on the page under inspection. Behavior depends on what the page ships.

| React (app) | DevTools extension | Profiler / bridge | Notes |
|-------------|--------------------|-------------------|--------|
| 18.x | Recommended | Supported | Primary target; fiber tags match [shared FiberTag enum](../src/shared/types.ts). |
| 17.x | Recommended | Supported | Context-changed flags differ; wasted-render heuristics account for 17 vs 18 bitmasks. |
| 19.x | Recommended | Best-effort | Test on real apps; internal tags and profiling details can change between minors. |
| None | N/A | No | Panel shows connection / detection messaging; no commits without React. |

**RSC (React Server Components):** Analysis features assume compatible RSC payloads when your framework provides them. Disable or ignore RSC panels if the app is purely client-rendered.

**Strict Mode:** Double rendering in development can increase render counts; interpret “wasted render” hints in context of StrictMode.

**Fast Refresh:** Hot reload resets component state and fiber identity; prefer short recordings after navigation for stable comparisons.

For automated coverage, see Vitest suites under `tests/unit` and Playwright specs under `tests/e2e`.
