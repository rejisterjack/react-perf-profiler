# @react-perf-profiler/vscode-extension

VS Code extension for viewing React performance profiling data directly in the editor.

## Features

- **Profile Viewer**: Opens exported `.json` profile files from React Perf Profiler
- **Component Tree**: View component render counts and wasted render indicators
- **Budget Checking**: Validates profiles against performance budget thresholds
- **Quick Actions**: Navigate from slow components to their source files

## Installation

1. Open VS Code
2. Go to Extensions (Cmd+Shift+X)
3. Search for "React Perf Profiler"
4. Click Install

Or install from VSIX:

```bash
code --install-extension react-perf-profiler-vscode.vsix
```

## Usage

1. Export a profile from the React Perf Profiler DevTools extension
2. Open the `.json` file in VS Code
3. The profile viewer opens automatically
4. Use the tree view in the sidebar to explore components

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `reactPerfProfiler.renderTimeThreshold` | `16` | Render time warning threshold (ms) |
| `reactPerfProfiler.wastedRenderThreshold` | `20` | Wasted render rate threshold (%) |
| `reactPerfProfiler.maxDisplayComponents` | `500` | Max components to display |

## Building from Source

```bash
cd integrations/vscode-extension
pnpm install
pnpm build
pnpm package  # Creates .vsix
```
