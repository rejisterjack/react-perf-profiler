# React Perf Profiler Plugin Development Guide

This guide explains how to create custom plugins for the React Perf Profiler.

## Table of Contents

- [Quick Start](#quick-start)
- [Plugin Interface](#plugin-interface)
- [Lifecycle Hooks](#lifecycle-hooks)
- [Plugin API](#plugin-api)
- [Plugin Context](#plugin-context)
- [Contributing Metrics](#contributing-metrics)
- [Settings Schema](#settings-schema)
- [Examples](#examples)

## Quick Start

The simplest way to create a plugin is using the `createPluginTemplate` helper:

```typescript
import { createPluginTemplate } from '@/panel/plugins';

const myPlugin = createPluginTemplate({
  id: 'com.example.my-plugin',
  name: 'My Custom Plugin',
  version: '1.0.0',
  description: 'Tracks custom metrics',
  
  onCommit: (commit, api, context) => {
    context.log('info', 'Commit captured!', commit.id);
  },
  
  onAnalyze: (commits, api, context) => {
    // Analyze commits and return custom metrics
    const customMetric = calculateSomething(commits);
    return { customMetric };
  },
});

// Register the plugin
pluginManager.register(myPlugin);
```

## Plugin Interface

A plugin must implement the `AnalysisPlugin` interface:

```typescript
interface AnalysisPlugin {
  /** Plugin metadata */
  metadata: PluginMetadata;
  
  /** Lifecycle hooks (all optional) */
  hooks?: {
    onCommit?: OnCommitHook;
    onAnalyze?: OnAnalyzeHook;
    onAnalysisComplete?: OnAnalysisCompleteHook;
    onExport?: OnExportHook;
    onImport?: OnImportHook;
    onEnable?: OnEnableHook;
    onDisable?: OnDisableHook;
    onRecordingStart?: OnRecordingStartHook;
    onRecordingStop?: OnRecordingStopHook;
    onClearData?: OnClearDataHook;
  };
  
  /** Optional: Get metrics for display */
  getMetrics?: (api: PluginAPI, context: PluginContext) => PluginMetric[];
  
  /** Optional: Get UI component */
  getUI?: (api: PluginAPI, context: PluginContext) => ComponentType<PluginUIProps> | null;
  
  /** Optional: Settings component */
  SettingsComponent?: ComponentType<{ api: PluginAPI; context: PluginContext }>;
  
  /** Optional: Cleanup function */
  destroy?: () => void;
}
```

### PluginMetadata

```typescript
interface PluginMetadata {
  id: string;              // Unique identifier (reverse domain format)
  name: string;            // Display name
  version: string;         // Semver version (e.g., "1.0.0")
  description?: string;    // Short description
  author?: string;         // Author name
  homepage?: string;       // Documentation URL
  enabledByDefault?: boolean;  // Whether to enable on registration
  settingsSchema?: PluginSettingSchema[];  // Settings UI schema
}
```

## Lifecycle Hooks

### onCommit

Called for each commit during profiling. Can transform commit data.

```typescript
onCommit: (commit, api, context) => {
  // Access commit data
  const { id, timestamp, nodes, duration } = commit;
  
  // Store custom data
  api.setPluginData('myKey', { commitId: id });
  
  // Log with plugin prefix
  context.log('info', 'Commit captured', id);
  
  // Optionally transform and return modified commit
  return { ...commit, customData: true };
}
```

### onAnalyze

Called during the analysis phase. Can contribute to analysis results.

```typescript
onAnalyze: (commits, api, context) => {
  const customData = api.getPluginData('myKey');
  
  // Analyze commits
  const result = analyzeCommits(commits);
  
  // Return partial analysis result (merged with others)
  return {
    myCustomAnalysis: result
  };
}
```

### onAnalysisComplete

Called when analysis completes. Return metrics to display.

```typescript
onAnalysisComplete: (result, api, context) => {
  return [
    {
      id: 'my-metric',
      name: 'My Metric',
      value: 42,
      formattedValue: '42 items',
      category: 'Custom',
      description: 'Number of items analyzed'
    }
  ];
}
```

### onExport / onImport

Handle data persistence across sessions.

```typescript
onExport: (data, api, context) => {
  return {
    ...data,
    myPlugin: api.getPluginData('myState')
  };
},

onImport: (data, api, context) => {
  if (data.myPlugin) {
    api.setPluginData('myState', data.myPlugin);
  }
}
```

### onEnable / onDisable

Called when plugin is enabled/disabled.

```typescript
onEnable: async (api, context) => {
  context.log('info', 'Plugin enabled');
  api.setPluginData('initialized', true);
},

onDisable: async (api, context) => {
  context.log('info', 'Plugin disabled');
  api.clearPluginData();
}
```

### onRecordingStart / onRecordingStop

Called when profiling starts/stops.

```typescript
onRecordingStart: (api, context) => {
  context.log('info', 'Recording started');
},

onRecordingStop: (api, context) => {
  context.log('info', 'Recording stopped');
}
```

### onClearData

Called when user clears profiling data.

```typescript
onClearData: (api, context) => {
  api.clearPluginData();
  context.log('info', 'Plugin data cleared');
}
```

## Plugin API

The `PluginAPI` provides methods to interact with the profiler:

### Data Access

```typescript
// Get all captured commits
const commits = api.getCommits();

// Get current analysis results
const results = api.getAnalysisResults();

// Get RSC payloads (if available)
const rscPayloads = api.getRSCPayloads();

// Get selected commit/component
const selectedCommit = api.getSelectedCommit();
const selectedComponent = api.getSelectedComponent();

// Check if recording
const isRecording = api.isRecording();
```

### Data Storage

```typescript
// Store plugin-specific data
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
  id: 'my-panel',
  title: 'My Panel',
  icon: 'chart',
  component: MyPanelComponent,
  position: 'sidebar'
});

// Show notification
api.showNotification({
  type: 'success',
  title: 'Analysis Complete',
  message: 'Found 3 issues',
  duration: 5000
});

// Register context menu item
api.registerContextMenuItem({
  id: 'my-action',
  label: 'Run My Action',
  icon: 'play',
  onClick: () => { ... }
});
```

### Actions

```typescript
// Run analysis
await api.runAnalysis();

// Export data
const json = api.exportData();

// Navigate
api.selectCommit(commitId);
api.selectComponent(componentName);
```

### Utilities

```typescript
// Walk fiber tree
api.walkFiberTree(commitId, (node, depth) => {
  console.log(node.displayName, depth);
  return true; // continue walking
});

// Get specific fiber node
const node = api.getFiberNode(commitId, nodeId);

// Debounce/throttle
const debounced = api.debounce(myFn, 100);
const throttled = api.throttle(myFn, 100);
```

## Plugin Context

The `PluginContext` provides plugin-specific utilities:

```typescript
// Get plugin ID
const id = context.pluginId;

// Get/set settings
const settings = context.getSettings<MySettings>();
context.setSettings({ option: 'value' });

// Logging (automatically prefixed with plugin ID)
context.log('info', 'Message');
context.log('warn', 'Warning');
context.log('error', 'Error');
context.log('debug', 'Debug info');

// Event system
context.emit('custom-event', payload);
const unsubscribe = context.on('custom-event', (payload) => {
  console.log('Received:', payload);
});
// Later...
unsubscribe();
```

## Contributing Metrics

Plugins can contribute metrics in two ways:

### 1. Using onAnalysisComplete hook

Return metrics when analysis completes:

```typescript
onAnalysisComplete: (result, api, context) => {
  return [
    {
      id: 'metric-id',
      name: 'Metric Name',
      value: 42,
      formattedValue: '42 items',
      description: 'What this metric means',
      category: 'Category',
      trend: 'up',           // 'up' | 'down' | 'neutral'
      trendPositive: true,   // Is the trend good?
      priority: 1            // Display order (lower first)
    }
  ];
}
```

### 2. Using getMetrics method

Provide metrics on-demand:

```typescript
getMetrics: (api, context) => {
  const state = api.getPluginData('myState');
  return [
    {
      id: 'live-metric',
      name: 'Live Metric',
      value: state?.count || 0,
      formattedValue: `${state?.count || 0} items`,
      category: 'Live'
    }
  ];
}
```

## Settings Schema

Define settings UI using the settings schema:

```typescript
metadata: {
  settingsSchema: [
    {
      key: 'maxItems',
      name: 'Maximum Items',
      description: 'Maximum number of items to track',
      type: 'number',
      defaultValue: 100,
      min: 10,
      max: 1000
    },
    {
      key: 'trackAll',
      name: 'Track All',
      description: 'Track all items without filtering',
      type: 'boolean',
      defaultValue: false
    },
    {
      key: 'filterMode',
      name: 'Filter Mode',
      type: 'select',
      defaultValue: 'all',
      options: [
        { label: 'All', value: 'all' },
        { label: 'Errors Only', value: 'errors' }
      ]
    },
    {
      key: 'ignoredPatterns',
      name: 'Ignored Patterns',
      type: 'string',
      defaultValue: 'test,spec'
    }
  ]
}
```

Access settings in hooks:

```typescript
onCommit: (commit, api, context) => {
  const settings = context.getSettings<{
    maxItems: number;
    trackAll: boolean;
  }>();
  
  if (settings.trackAll) {
    // Track everything
  }
}
```

## Examples

### Simple Counter Plugin

```typescript
const counterPlugin: AnalysisPlugin = {
  metadata: {
    id: 'com.example.counter',
    name: 'Commit Counter',
    version: '1.0.0',
  },
  
  hooks: {
    onCommit: (commit, api, context) => {
      const count = api.getPluginData<number>('count') || 0;
      api.setPluginData('count', count + 1);
    },
    
    onAnalysisComplete: (result, api, context) => {
      const count = api.getPluginData<number>('count') || 0;
      return [
        {
          id: 'commit-count',
          name: 'Total Commits',
          value: count,
          formattedValue: `${count} commits`,
          category: 'Stats'
        }
      ];
    },
    
    onClearData: (api, context) => {
      api.setPluginData('count', 0);
    }
  }
};
```

### Component Tracker Plugin

```typescript
const componentTracker: AnalysisPlugin = {
  metadata: {
    id: 'com.example.component-tracker',
    name: 'Component Tracker',
    version: '1.0.0',
    settingsSchema: [
      {
        key: 'targetComponents',
        name: 'Target Components',
        type: 'string',
        defaultValue: 'Button,Input'
      }
    ]
  },
  
  hooks: {
    onCommit: (commit, api, context) => {
      const settings = context.getSettings<{ targetComponents: string }>();
      const targets = settings.targetComponents.split(',').map(s => s.trim());
      
      const stats = api.getPluginData<Map<string, number>>('stats') || new Map();
      
      for (const node of commit.nodes || []) {
        if (targets.includes(node.displayName)) {
          const count = stats.get(node.displayName) || 0;
          stats.set(node.displayName, count + 1);
        }
      }
      
      api.setPluginData('stats', stats);
    },
    
    onClearData: (api, context) => {
      api.clearPluginData();
    }
  },
  
  getMetrics: (api, context) => {
    const stats = api.getPluginData<Map<string, number>>('stats');
    if (!stats) return [];
    
    return Array.from(stats.entries()).map(([name, count]) => ({
      id: `component-${name}`,
      name: `${name} Renders`,
      value: count,
      formattedValue: `${count} renders`,
      category: 'Components'
    }));
  }
};
```

### Event Correlation Plugin

```typescript
const eventCorrelationPlugin: AnalysisPlugin = {
  metadata: {
    id: 'com.example.event-correlator',
    name: 'Event Correlator',
    version: '1.0.0'
  },
  
  hooks: {
    onRecordingStart: (api, context) => {
      // Setup external event listeners
      const handler = (e: CustomEvent) => {
        const events = api.getPluginData<Array<{ type: string; time: number }>>('events') || [];
        events.push({ type: e.detail.type, time: Date.now() });
        api.setPluginData('events', events);
      };
      
      window.addEventListener('my-custom-event', handler);
      api.setPluginData('handler', handler);
    },
    
    onRecordingStop: (api, context) => {
      const handler = api.getPluginData('handler');
      window.removeEventListener('my-custom-event', handler);
    },
    
    onAnalyze: (commits, api, context) => {
      const events = api.getPluginData('events') || [];
      
      // Correlate events with commits
      const correlations = events.map(event => ({
        ...event,
        relatedCommits: commits.filter(c => 
          Math.abs(c.timestamp - event.time) < 100
        ).map(c => c.id)
      }));
      
      return { eventCorrelations: correlations };
    },
    
    onClearData: (api, context) => {
      api.clearPluginData();
    }
  }
};
```

## Best Practices

1. **Error Handling**: Use try-catch in hooks to prevent breaking other plugins
2. **Data Cleanup**: Always implement `onClearData` to clean up stored data
3. **Performance**: Keep hook execution fast (< 16ms) to avoid blocking
4. **Naming**: Use descriptive, unique IDs for your plugin and metrics
5. **Settings**: Provide sensible defaults and validation
6. **Documentation**: Add JSDoc comments to your plugin
7. **Type Safety**: Define TypeScript interfaces for your data structures

## Testing Plugins

```typescript
import { PluginManager } from '@/panel/plugins/PluginManager';
import { createMockAPI } from '@/panel/plugins/testing';

describe('My Plugin', () => {
  let manager: PluginManager;
  let mockAPI: ReturnType<typeof createMockAPI>;
  
  beforeEach(() => {
    mockAPI = createMockAPI();
    manager = new PluginManager(mockAPI);
  });
  
  it('should track commits', async () => {
    manager.register(myPlugin);
    await manager.enablePlugin(myPlugin.metadata.id);
    
    const commit = { id: '1', timestamp: Date.now(), nodes: [] };
    await manager.executeOnCommit(commit);
    
    expect(mockAPI.getPluginData('count')).toBe(1);
  });
});
```

## Registering Plugins

```typescript
import { getPluginManager, registerBuiltInPlugins } from '@/panel/plugins';

// Get or create the plugin manager
const pluginManager = getPluginManager(api);

// Register built-in plugins
registerBuiltInPlugins(pluginManager);

// Or register specific plugins
registerBuiltInPlugins(pluginManager, {
  enable: ['react-perf-profiler.built-in.redux-action-tracker']
});

// Register custom plugin
pluginManager.register(myCustomPlugin);
```
