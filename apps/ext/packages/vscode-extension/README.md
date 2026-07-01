# @react-perf-profiler/vscode-extension

VS Code extension that surfaces React Perf Profiler diagnostics inline.

Connects to a running instance of the browser extension (via the same service
worker the DevTools panel uses) and mirrors the analyzer's findings into the
editor: wasted renders are underlined, recommended `useCallback` / `useMemo`
wraps appear as code actions, and the performance score is shown in the
status bar.

## Why it exists

The DevTools panel shows you the problem; this extension shows you the fix
**where you're editing**. No more context-switching between the browser and
the editor.

## Install

Published to the VS Code Marketplace. Search for "React Perf Profiler" or
install the `.vsix` from the [Releases](https://github.com/rejisterjack/react-perf-profiler/releases) page.

## Usage

1. Open a React app in VS Code.
2. Open the same app in Chrome/Firefox with the React Perf Profiler extension
   installed.
3. Start a profiling session in the DevTools panel.
4. Diagnostics appear inline in VS Code as the analyzer runs.

## Features

- **Inline diagnostics** — wasted renders underlined in the editor
- **Code actions** — one-click `useCallback` / `useMemo` / `React.memo` wraps
- **Decoration provider** — per-component render counts in the gutter
- **Status bar** — current performance score

## Architecture

```
VS Code Extension Host
  ↕ (JSON-RPC over a local WebSocket)
Browser Extension Service Worker
  ↕
Analyzer Web Worker
```

The VS Code extension does not run the analyzer itself — it consumes the
running extension's analysis stream so the editor and the panel always agree.

## License

MIT.
