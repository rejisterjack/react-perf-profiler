import type { PluginContext } from './types';

export function createSandbox(pluginCode: string, context: PluginContext): Record<string, unknown> {
  const moduleExports: Record<string, unknown> = {};
  const moduleObj = { exports: moduleExports };

  const sandboxedGlobals: Record<string, unknown> = {
    console: {
      log: (...args: unknown[]) => console.log('[Plugin]', ...args),
      warn: (...args: unknown[]) => console.warn('[Plugin]', ...args),
      error: (...args: unknown[]) => console.error('[Plugin]', ...args),
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Map,
    Set,
    Promise,
    Error,
    module: moduleObj,
    exports: moduleExports,
    context,
  };

  const paramNames = Object.keys(sandboxedGlobals);
  const paramValues = Object.values(sandboxedGlobals);
  const wrappedCode = `"use strict";\n${pluginCode}`;

  try {
    const fn = new Function(...paramNames, wrappedCode);
    fn(...paramValues);
    return moduleObj.exports as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Plugin sandbox error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
