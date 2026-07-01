# @repo/profile-contract

Single source of truth for the React Perf Profiler **profile data contract**.

This package is consumed by:

- `apps/ext` (the browser extension) — the bridge, analyzer, and panel all
  serialize/deserialize `CommitData` and `AnalysisResult` defined here.
- `apps/web` (the API server) — the `POST /api/profiles` route validates
  uploaded payloads against the Zod schemas defined here.

## Why it exists

Before this package, the same interfaces (`FiberData`, `CommitData`,
`SourceLocation`, etc.) were copy-pasted across three files in the extension
and were untyped `Json` at the API boundary. This package eliminates that
drift.

## What it exports

### TypeScript types (`@repo/profile-contract`)

| Type                                                                                | Purpose                                                             |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `Severity`                                                                          | `'low' \| 'medium' \| 'high' \| 'critical'`                         |
| `SourceLocation`                                                                    | `{ fileName, lineNumber, columnNumber }`                            |
| `FiberData`                                                                         | A serialized React Fiber node (the raw unit captured by the bridge) |
| `RenderCause`                                                                       | Why a fiber re-rendered (`props-changed`, `state-changed`, …)       |
| `InteractionData`                                                                   | A React Scheduler interaction                                       |
| `CommitData`                                                                        | One React commit (the on-the-wire unit)                             |
| `ComponentMetrics`                                                                  | Aggregated per-component metrics                                    |
| `WastedRenderIssue`, `WastedRenderReport`                                           | Wasted-render analysis output                                       |
| `MemoIssue`, `MemoRecommendation`, `MemoReport`                                     | Memoization analysis output                                         |
| `OptimizationOpportunity`                                                           | A ranked optimization suggestion                                    |
| `AnomalyReport{Entry,Group}`, `TrendReportEntry`, `PatternReportEntry`              | Statistical analysis output                                         |
| `AnalysisResult`                                                                    | The full analysis envelope (also stored alongside profiles)         |
| `ProfileMetadata`, `ProfileRecord`, `ProfileUploadRequest`, `ProfileUploadResponse` | The API envelope                                                    |

### Zod schemas (`@repo/profile-contract/schema`)

`profileDataSchema` (a `z.array(commitDataSchema)`) and `profileUploadRequestSchema`
mirror the TypeScript types and are used by the web API for runtime validation.

## Usage

```ts
import type { CommitData } from '@repo/profile-contract';
import { profileUploadRequestSchema } from '@repo/profile-contract/schema';

const parsed = profileUploadRequestSchema.parse(body); // throws on malformed
```

## Constraints

This package **must not** import from `apps/ext` or `apps/web`, and must not
import any browser/Node-specific APIs. It is pure types and Zod schemas so it
can be consumed from a MAIN-world content script, a service worker, a Next.js
route handler, or a Web Worker without polyfills.
