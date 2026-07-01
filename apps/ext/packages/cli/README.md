# @react-perf-profiler/cli

Headless CLI for asserting React performance budgets in CI/CD.

Loads a profile JSON (exported from the extension or captured by a Playwright
run), runs [`@react-perf-profiler/analyzer`](../analyzer) against it, and fails
the build if any rule in your `perf-budget.json` is violated.

## Why it exists

The extension is great for interactive debugging, but teams also need to gate
**regressions** in CI. This CLI runs the same analyzer the panel uses, against
a saved profile, with declarative budgets that map to "this PR is allowed to
add at most N wasted renders to component X".

## Install

```bash
npm install --save-dev @react-perf-profiler/cli
```

## Usage

```bash
# Analyze a profile and print a human-readable report
rpp analyze ./profile.json

# Assert a perf budget (exits non-zero on violation)
rpp check ./profile.json --budget ./perf-budget.json

# Compare two profiles (current vs baseline)
rpp compare ./current.json --baseline ./baseline.json
```

## Budget file

A `perf-budget.json` declares rules that the analyzer result is checked
against:

```json
{
  "rules": [
    {
      "componentPattern": "*",
      "maxRenderCount": 100,
      "maxWastedRenderRate": 50
    },
    {
      "componentPattern": "App",
      "maxRenderCount": 20
    }
  ]
}
```

| Field                 | Description                                            |
| --------------------- | ------------------------------------------------------ |
| `componentPattern`    | Glob matched against `componentName`. `*` matches all. |
| `maxRenderCount`      | Maximum total renders for matching components.         |
| `maxWastedRenderRate` | Maximum wasted-render rate (0–100, percent).           |

## CI integration

```yaml
# .github/workflows/perf-check.yml
- name: Assert performance budget
  run: rpp check ./profile.json --budget ./perf-budget.json
```

Typically paired with a Playwright step that captures the profile by driving
the app with the extension's `START_PROFILING` / `STOP_PROFILING` commands.

## License

MIT.
