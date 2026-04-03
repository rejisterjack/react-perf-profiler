# React Perf Profiler Documentation

Welcome to the React Perf Profiler documentation. This directory contains comprehensive guides, API references, and resources for using and extending the profiler.

## Documentation index

### Getting started

| Document | Description |
|----------|-------------|
| [Plugin Development Guide](./PLUGIN_DEVELOPMENT.md) | Create custom analysis plugins |
| [Performance Budgets Guide](./PERFORMANCE_BUDGETS.md) | CI/CD integration and budget configuration |
| [API Reference (stores & hooks)](./API_REFERENCE.md) | Panel stores, hooks, and utilities |
| [Programmatic API](./API.md) | Analysis utilities, plugins, and CI-oriented APIs |

### Release and publishing

| Document | Description |
|----------|-------------|
| [Release Checklist](./RELEASE_CHECKLIST.md) | Full QA, versioning, and release process |
| [Store release](./STORE_RELEASE.md) | Tag, GitHub Release zips, store consoles |
| [Store Assets](./STORE_ASSETS.md) | Listings, screenshots, promos, privacy copy |

### Technical reference

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | System design and data flow |
| [Error Handling](./ERROR_HANDLING.md) | Error management strategies |
| [RSC Analysis](./RSC_ANALYSIS.md) | React Server Components support |
| [Troubleshooting](./TROUBLESHOOTING.md) | Common issues and solutions |
| [Performance Budget CI](./PERF_BUDGET_CI.md) | CI performance budget setup |

## Quick links

- **Main README**: [../README.md](../README.md)
- **Contributing**: [../CONTRIBUTING.md](../CONTRIBUTING.md)
- **Changelog**: [../CHANGELOG.md](../CHANGELOG.md)

## Store assets layout

Listing copy, privacy sources, promos, and store-sized screenshots live under [store-assets/](store-assets/). Extension icons shipped in the build are in [../public/icons/](../public/icons/) (SVG).

## Plugin development

Get started with plugin development:

```typescript
import type { AnalysisPlugin } from '@/panel/plugins';

const myPlugin: AnalysisPlugin = {
  metadata: {
    id: 'com.example.my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
  },
  hooks: {
    onCommit: (commit, api, context) => {
      context.log('info', 'Commit captured!', commit.id);
    },
  },
};
```

See [Plugin Development Guide](./PLUGIN_DEVELOPMENT.md) for the complete guide.

## Performance budgets

Configure `perf-budget.json`:

```json
{
  "version": 1,
  "wastedRenderThreshold": 0.1,
  "memoHitRateThreshold": 0.8,
  "maxRenderTimeMs": 16,
  "minPerformanceScore": 70,
  "budgets": [
    {
      "id": "custom-budget",
      "name": "Custom Budget",
      "threshold": 100,
      "severity": "error",
      "enabled": true
    }
  ]
}
```

See [Performance Budgets Guide](./PERFORMANCE_BUDGETS.md) for details.

## External resources

- [React DevTools](https://github.com/facebook/react/tree/main/packages/react-devtools)
- [React Profiler API](https://react.dev/reference/react/Profiler)
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Firefox Extension Documentation](https://extensionworkshop.com/)

---

*For questions or support, please open an issue on the [GitHub repository](https://github.com/rejisterjack/react-perf-profiler).*
