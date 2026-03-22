# Plugin Development Guide

A comprehensive guide for creating custom plugins to extend React Perf Profiler's functionality.

## Table of Contents

- [Getting Started](#getting-started)
- [AnalysisPlugin Interface](#analysisplugin-interface)
- [Lifecycle Hooks](#lifecycle-hooks)
- [Plugin API Reference](#plugin-api-reference)
- [Example Plugin Walkthrough](#example-plugin-walkthrough)
- [Best Practices](#best-practices)
- [Publishing Plugins](#publishing-plugins)

---

## Getting Started

### What Are Plugins?

Plugins extend React Perf Profiler with custom analysis, metrics, and UI panels. They can:

- Analyze commits and contribute custom metrics
- Add custom panels to the profiler UI
- Track external events and correlate them with renders
- Export/import custom data
- Transform and filter commit data

### Quick Start

Create your first plugin in 5 minutes:

```typescript
import type { AnalysisPlugin, PluginAPI, PluginContext } from '@/panel/plugins';

const myPlugin: AnalysisPlugin = {
  metadata: {
    id: 'com.example.my-plugin',
    name: 'My First Plugin',
    version: '1.0.0',
    description: 'Counts total commits captured',
    author: 'Your Name',
  },
  
  hooks: {
    onCommit: (commit, api, context) => {
      const count = api.getPluginData<number>('count') || 0;
      api.setPluginData('count', count + 1);
      context.log('info', `Commit captured: ${commit.id}`);
    },
    
    onAnalysisComplete: (result, api, context) => {
      const count = api.getPluginData<number>('count') || 0;
      return [{
        id: 'commit-count',
        name: 'Total Commits',
        value: count,
        formattedValue: `${count} commits`,
        category: 'Custom Analysis',
        description: 'Total commits captured during profiling',
      }];
    },
  },
};

// Register the plugin
pluginManager.register(myPlugin);
```

---

## AnalysisPlugin Interface

The `AnalysisPlugin` interface is the foundation of all plugins.

```typescript
interface AnalysisPlugin {
  /** Plugin metadata (required) */
  metadata: PluginMetadata;
  
  /** Lifecycle hooks (optional) */
  hooks?: PluginHooks;
  
  /** Get metrics on-demand (optional) */
  getMetrics?: (api: PluginAPI, context: PluginContext) => PluginMetric[];
  
  /** Get UI component (optional) */
  getUI?: (api: PluginAPI, context: PluginContext) => ComponentType<PluginUIProps> | null;
  
  /** Settings component (optional) */
  SettingsComponent?: ComponentType<PluginSettingsProps>;
  
  /** Cleanup function (optional) */
  destroy?: () => void;
}
```

### PluginMetadata

```typescript
interface PluginMetadata {
  /** Unique identifier (reverse domain format recommended) */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Semantic version */
  version: string;
  
  /** Short description */
  description?: string;
  
  /** Author name */
  author?: string;
  
  /** Homepage/documentation URL */
  homepage?: string;
  
  /** Enable by default */
  enabledByDefault?: boolean;
  
  /** Settings schema for UI */
  settingsSchema?: PluginSettingSchema[];
}
```

### Plugin ID Conventions

Use reverse domain notation for plugin IDs to avoid collisions:

```typescript
// Good
'com.yourcompany.redux-tracker'
'org.opensource.custom-metrics'
'dev.yourname.rsc-analyzer'

// Avoid
'my-plugin'
'redux'
'plugin1'
```

---

## Lifecycle Hooks

Hooks are called at specific points during the profiler's operation.

### Hook Execution Order

```
onEnable (when plugin is enabled)
  ↓
onRecordingStart (when user clicks Record)
  ↓
onCommit (called for each commit during profiling)
  ↓
onRecordingStop (when user clicks Stop)
  ↓
onAnalyze (during analysis phase)
  ↓
onAnalysisComplete (after analysis finishes)
  ↓
onExport (when user exports data)
  ↓
onImport (when user imports data)
  ↓
onClearData (when user clears data)
  ↓
onDisable (when plugin is disabled)
```

### onCommit

Called for each commit captured during profiling. Can transform commit data.

```typescript
onCommit: (commit, api, context) => {
  // Access commit data
  const { id, timestamp, nodes, duration } = commit;
  
  // Extract specific information
  const componentNames = nodes?.map(n => n.displayName) || [];
  
  // Store data for later
  api.setPluginData('lastCommitId', id);
  
  // Log with plugin prefix
  context.log('info', `Commit ${id} with ${nodes?.length || 0} nodes`);
  
  // Optionally transform commit (return modified commit)
  return { ...commit, customData: { componentNames } };
}
```

**Execution:** Sequential (each plugin receives result from previous)

### onAnalyze

Called during the analysis phase. Contribute to analysis results.

```typescript
onAnalyze: (commits, api, context) => {
  // Access all commits
  const totalNodes = commits.reduce((sum, c) => sum + (c.nodes?.length || 0), 0);
  
  // Calculate custom metrics
  const averageNodesPerCommit = totalNodes / commits.length;
  
  // Return partial analysis result (merged with others)
  return {
    customMetrics: {
      averageNodesPerCommit,
      totalNodes,
    },
  };
}
```

**Execution:** Parallel (all plugins analyze same commits simultaneously)

### onAnalysisComplete

Called when analysis completes. Return metrics to display.

```typescript
onAnalysisComplete: (result, api, context) => {
  const customData = api.getPluginData('myAnalysis');
  
  return [
    {
      id: 'custom-metric',
      name: 'Custom Metric',
      value: customData?.value || 0,
      formattedValue: `${customData?.value || 0} units`,
      category: 'Custom',
      trend: 'up',
      trendPositive: true,
      description: 'A custom metric from my plugin',
      priority: 1,
    },
  ];
}
```

**Execution:** Parallel

### onExport / onImport

Handle data persistence across sessions.

```typescript
hooks: {
  onExport: (data, api, context) => {
    // Add plugin data to export
    return {
      ...data,
      myPlugin: {
        version: '1.0.0',
        state: api.getPluginData('state'),
        metrics: api.getPluginData('metrics'),
      },
    };
  },
  
  onImport: (data, api, context) => {
    // Restore plugin state from import
    if (data.myPlugin) {
      api.setPluginData('state', data.myPlugin.state);
      api.setPluginData('metrics', data.myPlugin.metrics);
      context.log('info', 'Plugin state restored');
    }
  },
}
```

**Execution:** Export is sequential, Import is parallel

### onEnable / onDisable

Called when plugin is enabled or disabled.

```typescript
hooks: {
  onEnable: async (api, context) => {
    context.log('info', 'Plugin enabled');
    
    // Initialize plugin data
    api.setPluginData('initialized', true);
    api.setPluginData('startTime', Date.now());
    
    // Show notification
    api.showNotification({
      type: 'success',
      title: 'Plugin Enabled',
      message: 'My Plugin is now active',
    });
  },
  
  onDisable: async (api, context) => {
    context.log('info', 'Plugin disabled');
    
    // Cleanup
    api.clearPluginData();
  },
}
```

### onRecordingStart / onRecordingStop

Called when profiling starts or stops.

```typescript
hooks: {
  onRecordingStart: (api, context) => {
    // Reset counters
    api.setPluginData('commitCount', 0);
    api.setPluginData('startTime', Date.now());
    
    // Setup external listeners if needed
    window.addEventListener('custom-event', handleCustomEvent);
  },
  
  onRecordingStop: (api, context) => {
    const duration = Date.now() - (api.getPluginData<number>('startTime') || 0);
    api.setPluginData('recordingDuration', duration);
    
    // Cleanup listeners
    window.removeEventListener('custom-event', handleCustomEvent);
  },
}
```

### onClearData

Called when user clears all profiling data.

```typescript
onClearData: (api, context) => {
  // Clear plugin-specific data
  api.clearPluginData();
  
  // Reset to initial state
  api.setPluginData('initialized', true);
}
```

### RSC Hooks

For React Server Components analysis:

```typescript
hooks: {
  onRSCPayload: (payload, api, context) => {
    // Process RSC payload
    const size = payload.totalSize;
    context.log('info', `RSC payload received: ${size} bytes`);
    
    // Track payload sizes
    const sizes = api.getPluginData<number[]>('payloadSizes') || [];
    sizes.push(size);
    api.setPluginData('payloadSizes', sizes);
  },
  
  onRSCAnalyze: (result, api, context) => {
    // Contribute to RSC analysis
    const sizes = api.getPluginData<number[]>('payloadSizes') || [];
    const averageSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    
    return {
      customRSCMetrics: {
        averagePayloadSize: averageSize,
        totalPayloads: sizes.length,
      },
    };
  },
}
```

---

## Plugin API Reference

The `PluginAPI` provides methods to interact with the profiler.

### Data Access

```typescript
// Get all captured commits
const commits = api.getCommits();

// Get current analysis results
const results = api.getAnalysisResults();

// Get RSC payloads
const rscPayloads = api.getRSCPayloads();

// Get RSC analysis
const rscAnalysis = api.getRSCAnalysis();

// Get profiler configuration
const config = api.getConfig();

// Get selected commit/component
const selectedCommit = api.getSelectedCommit();
const selectedComponent = api.getSelectedComponent();

// Check recording state
const isRecording = api.isRecording();
```

### Data Storage

```typescript
// Store plugin-specific data (isolated per plugin)
api.setPluginData('myKey', { foo: 'bar' });

// Retrieve data
const data = api.getPluginData('myKey');

// Remove specific key
api.removePluginData('myKey');

// Clear all plugin data
api.clearPluginData();
```

### UI Integration

```typescript
// Register a custom panel
const unregister = api.registerPanel({
  id: 'my-custom-panel',
  title: 'My Analysis',
  icon: 'Chart',
  component: MyPanelComponent,
  position: 'sidebar', // 'sidebar' | 'main' | 'detail' | 'modal'
  order: 10,
});

// Show notification
api.showNotification({
  type: 'success', // 'info' | 'success' | 'warning' | 'error'
  title: 'Analysis Complete',
  message: 'Found 3 optimization opportunities',
  duration: 5000, // ms, 0 for no auto-dismiss
});

// Register context menu item
api.registerContextMenuItem({
  id: 'my-action',
  label: 'Run Custom Analysis',
  icon: 'Play',
  onClick: () => {
    // Handle click
  },
  condition: () => api.getCommits().length > 0, // Show condition
});
```

### Actions

```typescript
// Run analysis
await api.runAnalysis();

// Export data
const json = api.exportData();

// Navigate to commit/component
api.selectCommit(commitId);
api.selectComponent(componentName);
```

### Fiber Tree Utilities

```typescript
// Walk the fiber tree
api.walkFiberTree(commitId, (node, depth) => {
  console.log(`${'  '.repeat(depth)}${node.displayName}`);
  return true; // return false to stop walking this branch
});

// Get specific fiber node
const node = api.getFiberNode(commitId, nodeId);
```

### Utilities

```typescript
// Debounce function
const debounced = api.debounce(myFn, 100);

// Throttle function
const throttled = api.throttle(myFn, 100);
```

### PluginContext

The context provides plugin-specific utilities:

```typescript
// Get plugin ID
const id = context.pluginId;

// Get/set settings
const settings = context.getSettings<MySettings>();
context.setSettings({ option: 'value' });

// Logging (automatically prefixed with plugin ID)
context.log('debug', 'Debug message');
context.log('info', 'Info message');
context.log('warn', 'Warning message');
context.log('error', 'Error message');

// Event system
context.emit('custom-event', payload);
const unsubscribe = context.on('custom-event', (payload) => {
  console.log('Received:', payload);
});
unsubscribe(); // Remove listener
```

---

## Example Plugin Walkthrough

Let's build a complete Redux action tracker plugin step by step.

### Step 1: Define the Plugin Structure

```typescript
import type { AnalysisPlugin, PluginAPI, PluginContext, PluginMetric } from '@/panel/plugins';

interface ReduxAction {
  type: string;
  timestamp: number;
  payload?: unknown;
}

interface ReduxSettings {
  maxActions: number;
  actionTypes: string[];
}

const ReduxTrackerPlugin: AnalysisPlugin = {
  metadata: {
    id: 'react-perf-profiler.built-in.redux-action-tracker',
    name: 'Redux Action Tracker',
    version: '1.0.0',
    description: 'Tracks Redux actions and correlates with React renders',
    author: 'React Perf Profiler Team',
    enabledByDefault: false,
    settingsSchema: [
      {
        key: 'maxActions',
        name: 'Maximum Actions',
        description: 'Maximum number of actions to track',
        type: 'number',
        defaultValue: 100,
        min: 10,
        max: 1000,
      },
      {
        key: 'actionTypes',
        name: 'Action Types',
        description: 'Comma-separated list of action types to track (empty = all)',
        type: 'string',
        defaultValue: '',
      },
    ],
  },
  
  hooks: {
    // We'll implement these next
  },
};
```

### Step 2: Implement Recording Hooks

```typescript
hooks: {
  onRecordingStart: (api, context) => {
    const settings = context.getSettings<ReduxSettings>();
    
    // Initialize storage
    api.setPluginData('actions', []);
    api.setPluginData('renderCorrelations', []);
    
    // Subscribe to Redux actions
    const handleAction = (event: CustomEvent<ReduxAction>) => {
      const actions = api.getPluginData<ReduxAction[]>('actions') || [];
      const action = event.detail;
      
      // Filter by type if configured
      if (settings.actionTypes.length > 0) {
        const allowedTypes = settings.actionTypes.split(',').map(s => s.trim());
        if (!allowedTypes.includes(action.type)) return;
      }
      
      // Add action
      actions.push(action);
      
      // Enforce max actions limit
      if (actions.length > settings.maxActions) {
        actions.shift();
      }
      
      api.setPluginData('actions', actions);
    };
    
    window.addEventListener('redux-action', handleAction as EventListener);
    api.setPluginData('actionHandler', handleAction);
  },
  
  onRecordingStop: (api, context) => {
    // Cleanup
    const handler = api.getPluginData('actionHandler');
    if (handler) {
      window.removeEventListener('redux-action', handler as EventListener);
    }
  },
}
```

### Step 3: Correlate with Commits

```typescript
hooks: {
  onCommit: (commit, api, context) => {
    const actions = api.getPluginData<ReduxAction[]>('actions') || [];
    
    // Find actions that occurred just before this commit
    const correlatedActions = actions.filter(action => 
      Math.abs(action.timestamp - commit.timestamp) < 50
    );
    
    if (correlatedActions.length > 0) {
      const correlations = api.getPluginData<Array<{
        commitId: string;
        actions: ReduxAction[];
      }>>('renderCorrelations') || [];
      
      correlations.push({
        commitId: commit.id,
        actions: correlatedActions,
      });
      
      api.setPluginData('renderCorrelations', correlations);
    }
  },
}
```

### Step 4: Generate Metrics

```typescript
hooks: {
  onAnalysisComplete: (result, api, context) => {
    const actions = api.getPluginData<ReduxAction[]>('actions') || [];
    const correlations = api.getPluginData('renderCorrelations') || [];
    
    // Count action types
    const actionTypeCounts = actions.reduce((acc, action) => {
      acc[action.type] = (acc[action.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Find most common action
    const mostCommonAction = Object.entries(actionTypeCounts)
      .sort((a, b) => b[1] - a[1])[0];
    
    const metrics: PluginMetric[] = [
      {
        id: 'total-actions',
        name: 'Total Redux Actions',
        value: actions.length,
        formattedValue: `${actions.length} actions`,
        category: 'Redux',
        description: 'Total Redux actions dispatched',
      },
      {
        id: 'correlated-renders',
        name: 'Action-Triggered Renders',
        value: correlations.length,
        formattedValue: `${correlations.length} renders`,
        category: 'Redux',
        description: 'Renders correlated with Redux actions',
      },
    ];
    
    if (mostCommonAction) {
      metrics.push({
        id: 'most-common-action',
        name: 'Most Common Action',
        value: mostCommonAction[1],
        formattedValue: `${mostCommonAction[0]} (${mostCommonAction[1]})`,
        category: 'Redux',
        description: 'Most frequently dispatched action type',
      });
    }
    
    return metrics;
  },
}
```

### Step 5: Add Custom UI Panel

```typescript
import { createElement } from 'react';

// Panel component
const ReduxPanel: React.FC<{ api: PluginAPI; context: PluginContext }> = ({ api, context }) => {
  const actions = api.getPluginData<ReduxAction[]>('actions') || [];
  const correlations = api.getPluginData('renderCorrelations') || [];
  
  return createElement('div', { className: 'redux-panel' }, [
    createElement('h3', { key: 'title' }, 'Redux Actions'),
    createElement('ul', { key: 'list' }, 
      actions.slice(-10).map(action => 
        createElement('li', { key: action.timestamp }, action.type)
      )
    ),
    createElement('div', { key: 'correlations' }, [
      createElement('h4', { key: 'title' }, 'Correlated Renders'),
      createElement('p', { key: 'count' }, `${correlations.length} renders triggered by actions`),
    ]),
  ]);
};

// Add to plugin
getUI: (api, context) => {
  return () => createElement(ReduxPanel, { api, context });
},
```

### Step 6: Handle Export/Import

```typescript
hooks: {
  onExport: (data, api, context) => {
    return {
      ...data,
      reduxTracker: {
        version: '1.0.0',
        actions: api.getPluginData('actions'),
        correlations: api.getPluginData('renderCorrelations'),
      },
    };
  },
  
  onImport: (data, api, context) => {
    if (data.reduxTracker) {
      api.setPluginData('actions', data.reduxTracker.actions || []);
      api.setPluginData('renderCorrelations', data.reduxTracker.correlations || []);
    }
  },
  
  onClearData: (api, context) => {
    api.setPluginData('actions', []);
    api.setPluginData('renderCorrelations', []);
  },
}
```

---

## Best Practices

### Error Handling

Always wrap plugin logic in try-catch blocks. Plugin failures are isolated but logged:

```typescript
hooks: {
  onCommit: (commit, api, context) => {
    try {
      // Your logic here
      riskyOperation();
    } catch (error) {
      context.log('error', 'Failed to process commit:', error);
      // Don't re-throw - let other plugins continue
    }
  },
}
```

### Performance

Keep hook execution fast to avoid blocking the profiler:

```typescript
// ❌ Bad: Heavy computation in onCommit
onCommit: (commit) => {
  const result = heavyAnalysis(commit); // Blocks for 100ms
}

// ✅ Good: Defer heavy work to onAnalyze
onCommit: (commit, api) => {
  const data = api.getPluginData('commits') || [];
  data.push({ id: commit.id, timestamp: commit.timestamp });
  api.setPluginData('commits', data);
},

onAnalyze: (commits, api) => {
  // Heavy work happens here, off the main thread
  const result = heavyAnalysis(commits);
  return { analysis: result };
}
```

### Data Cleanup

Always implement `onClearData` to prevent memory leaks:

```typescript
hooks: {
  onClearData: (api, context) => {
    // Clear all plugin data
    api.clearPluginData();
    
    // Or selectively clear
    api.removePluginData('temporaryData');
  },
}
```

### Settings Validation

Validate settings before using them:

```typescript
hooks: {
  onEnable: (api, context) => {
    const settings = context.getSettings();
    
    // Validate required settings
    if (!settings.apiKey) {
      context.log('warn', 'API key not configured');
      return;
    }
    
    // Validate numeric ranges
    const maxItems = Math.max(1, Math.min(1000, settings.maxItems || 100));
    api.setPluginData('maxItems', maxItems);
  },
}
```

### Type Safety

Define TypeScript interfaces for your plugin data:

```typescript
interface MyPluginData {
  count: number;
  items: string[];
  config: {
    enabled: boolean;
    threshold: number;
  };
}

// Use type-safe accessors
const data = api.getPluginData<MyPluginData>('myData');
```

### Testing

Write unit tests for your plugins:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PluginManager } from '@/panel/plugins/PluginManager';
import { createMockAPI } from '@/panel/plugins/testing';
import myPlugin from './myPlugin';

describe('MyPlugin', () => {
  let manager: PluginManager;
  let mockAPI: ReturnType<typeof createMockAPI>;
  
  beforeEach(() => {
    mockAPI = createMockAPI();
    manager = new PluginManager(mockAPI);
    manager.register(myPlugin);
  });
  
  it('should track commits', async () => {
    await manager.enablePlugin(myPlugin.metadata.id);
    
    const commit = { id: '1', timestamp: Date.now(), nodes: [] };
    await manager.executeOnCommit(commit);
    
    expect(mockAPI.getPluginData('count')).toBe(1);
  });
  
  it('should generate metrics', async () => {
    await manager.enablePlugin(myPlugin.metadata.id);
    
    mockAPI.setPluginData('count', 5);
    const result = await manager.executeOnAnalysisComplete({} as AnalysisResult);
    
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(5);
  });
});
```

---

## Publishing Plugins

### Distribution Options

1. **Built-in Plugins**: Include with the profiler (submit PR)
2. **npm Package**: Publish as standalone package
3. **GitHub Gist**: Share as single-file plugin
4. **Plugin Registry**: Submit to community registry

### Package Structure

```
my-react-perf-plugin/
├── package.json
├── src/
│   ├── index.ts          # Main plugin export
│   ├── components/       # UI components
│   └── utils/            # Helper functions
├── README.md
└── tsconfig.json
```

### package.json Template

```json
{
  "name": "my-react-perf-plugin",
  "version": "1.0.0",
  "description": "Custom plugin for React Perf Profiler",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "react-perf-profiler": ">=1.0.0",
    "react": ">=18.0.0"
  },
  "keywords": [
    "react-perf-profiler",
    "plugin",
    "performance"
  ]
}
```

### Submission Checklist

- [ ] Plugin has unique ID
- [ ] Metadata is complete
- [ ] Settings schema is defined (if applicable)
- [ ] Error handling is implemented
- [ ] onClearData cleans up data
- [ ] Documentation is included
- [ ] Tests pass
- [ ] No console.log (use context.log instead)
- [ ] Performance impact is minimal

---

## Resources

- [Built-in Plugins](../src/panel/plugins/built-in/) - Reference implementations
- [Type Definitions](../src/panel/plugins/types.ts) - Complete type reference
- [Example Plugin](./EXAMPLE_PLUGIN.md) - Starter template
- [GitHub Discussions](https://github.com/rejisterjack/react-perf-profiler/discussions) - Community support
