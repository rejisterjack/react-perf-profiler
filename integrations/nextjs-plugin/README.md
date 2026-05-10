# @react-perf-profiler/nextjs-plugin

Next.js webpack plugin that enforces React performance budgets at build time.

## Installation

```bash
npm install --save-dev @react-perf-profiler/nextjs-plugin
# or
pnpm add -D @react-perf-profiler/nextjs-plugin
```

## Usage

```js
// next.config.js
const withPerfProfiler = require('@react-perf-profiler/nextjs-plugin')({
  renderTime: 16,       // Warn if any component exceeds 16ms render
  renderCount: 10,      // Warn if any component renders >10 times
  failOnViolation: false, // Set true to fail the build
  profilePath: './profile.json', // Path to exported profiler data
});

module.exports = withPerfProfiler({
  // your normal Next.js config
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `renderTime` | `number` | `16` | Max render time per component (ms) |
| `renderCount` | `number` | `10` | Max render count per component |
| `failOnViolation` | `boolean` | `false` | Fail the build on violations |
| `profilePath` | `string` | - | Path to exported profile JSON |

## How It Works

1. During development builds, loads the specified profile JSON
2. Analyzes each component's render time and render count
3. Compares against configured budgets
4. Reports violations as warnings (or errors if `failOnViolation` is true)
5. Injects budget constants as `__PERF_BUDGETS__` for runtime checks
