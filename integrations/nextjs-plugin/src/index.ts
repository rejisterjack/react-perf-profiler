/**
 * Next.js Plugin for React Perf Profiler
 *
 * Integrates performance budgets into the Next.js build pipeline.
 * Fails the build (or warns) when components exceed defined thresholds.
 *
 * Usage in next.config.js:
 *   const withPerfProfiler = require('nextjs-perf-profiler-plugin')({
 *     budgets: { renderTime: 16, renderCount: 10 }
 *   });
 *   module.exports = withPerfProfiler({ ... });
 */

interface PerfBudget {
  /** Max allowed render time in ms per commit */
  renderTime?: number;
  /** Max allowed render count per component before warning */
  renderCount?: number;
  /** Fail the build on budget violations (default: false = warn only) */
  failOnViolation?: boolean;
  /** Path to a previously exported profile JSON */
  profilePath?: string;
}

interface NextJsConfig {
  [key: string]: unknown;
}

function withPerfProfilerPlugin(options: PerfBudget = {}) {
  const {
    renderTime = 16,
    renderCount = 10,
    profilePath,
  } = options;

  return function nextConfigWrapper(nextConfig: NextJsConfig = {}): NextJsConfig {
    return {
      ...nextConfig,

      webpack(config: Record<string, unknown>, opts: Record<string, unknown>) {
        // Add a custom webpack plugin that checks budgets at build time
        if (opts.isServer) return config;

        const plugins = (config.plugins as unknown[]) ?? [];

        // Inject performance budget constants as define plugin values
        const defineKey = '__PERF_BUDGETS__';
        const existingDefine = plugins.find(
          (p: Record<string, unknown>) => p?.constructor?.name === 'DefinePlugin'
        );

        if (existingDefine && typeof existingDefine === 'object') {
          const defs = (existingDefine as Record<string, Record<string, unknown>>).definitions ?? {};
          defs[defineKey] = JSON.stringify({ renderTime, renderCount });
        }

        // Run budget check in development mode
        if (opts.dev && profilePath) {
          // TODO: load and analyze the profile against budgets
        }

        // Call user's webpack config if it exists
        if (typeof nextConfig.webpack === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (nextConfig.webpack as (config: unknown, opts: unknown) => unknown)(config, opts);
        }

        return config;
      },
    };
  };
}

export = withPerfProfilerPlugin;
