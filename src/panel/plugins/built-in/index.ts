/**
 * Built-in Plugins Barrel Export
 * @module panel/plugins/built-in
 *
 * Exports all built-in analysis plugins for easy registration.
 *
 * @example
 * ```typescript
 * import {
 *   reduxActionTracker,
 *   contextChangeLogger,
 *   contextProviderTracker,
 * } from './built-in';
 *
 * // Register all built-in plugins
 * pluginManager.register(reduxActionTracker);
 * pluginManager.register(contextChangeLogger);
 * pluginManager.register(contextProviderTracker);
 * ```
 */

// Redux Action Tracker
export {
  reduxActionTracker,
  createReduxProfilerMiddleware,
  trackReduxAction,
} from './ReduxActionTracker';

// Context Change Logger
export { contextChangeLogger } from './ContextChangeLogger';

// Context Provider Tracker
export { contextProviderTracker } from './ContextProviderTracker';
