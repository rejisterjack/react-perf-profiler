# React Perf Profiler Documentation

Welcome to the React Perf Profiler documentation. This directory contains comprehensive guides, API references, and resources for using and extending the profiler.

## 📖 Documentation Index

### Getting Started

| Document | Description |
|----------|-------------|
| [Plugin Development Guide](./PLUGIN_DEVELOPMENT.md) | Create custom analysis plugins |
| [Performance Budgets Guide](./PERFORMANCE_BUDGETS.md) | CI/CD integration and budget configuration |
| [API Reference](./API_REFERENCE.md) | Complete API documentation for stores, hooks, and utilities |

### Release & Publishing

| Document | Description |
|----------|-------------|
| [Release Checklist](./RELEASE_CHECKLIST.md) | Step-by-step release process |
| [Store Assets](./STORE_ASSETS.md) | Chrome Web Store & Firefox Add-ons assets |

### Technical Reference

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | System design and data flow |
| [API Reference](./API.md) | Core API documentation |
| [Error Handling](./ERROR_HANDLING.md) | Error management strategies |
| [RSC Analysis](./RSC_ANALYSIS.md) | React Server Components support |
| [Troubleshooting](./TROUBLESHOOTING.md) | Common issues and solutions |
| [Performance Budget CI](./PERF_BUDGET_CI.md) | CI/CD performance budget setup |

## 🚀 Quick Links

- **Main README**: [../README.md](../README.md)
- **Contributing**: [../CONTRIBUTING.md](../CONTRIBUTING.md)
- **Changelog**: [../CHANGELOG.md](../CHANGELOG.md)

## 📦 Store Assets

Promotional images, screenshots, and store listing content:

```
store-assets/
├── screenshots/        # Extension screenshots
├── promotional/        # Store promotional images
├── listing/           # Store listing text
├── privacy/           # Privacy policies
└── icons/             # Extension icons
```

## 🛠️ Plugin Development

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

## 📊 Performance Budgets

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

## 🔗 External Resources

- [React DevTools](https://github.com/facebook/react/tree/main/packages/react-devtools)
- [React Profiler API](https://react.dev/reference/react/Profiler)
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Firefox Extension Documentation](https://extensionworkshop.com/)

---

*For questions or support, please open an issue on the [GitHub repository](https://github.com/rejisterjack/react-perf-profiler).*
