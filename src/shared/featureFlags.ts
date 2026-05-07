/**
 * Runtime feature flags system.
 *
 * Flags are stored in chrome.storage.local so they persist across sessions
 * and can be toggled without rebuilding the extension.
 *
 * Build-time env vars (VITE_ENABLE_*) take precedence at startup;
 * runtime overrides via chrome.storage can then flip individual flags.
 */

export interface FeatureFlags {
  /** Enable 3D component tree visualization */
  enable3DVisualization: boolean;
  /** Enable AI-powered suggestions panel */
  enableAISuggestions: boolean;
  /** Enable cloud sync UI */
  enableCloudSync: boolean;
  /** Enable collaboration / team sessions */
  enableCollaboration: boolean;
  /** Enable plugin marketplace */
  enableMarketplace: boolean;
  /** Enable RSC analysis */
  enableRSCAnalysis: boolean;
  /** Enable performance budget CI/CD integration */
  enablePerfBudgets: boolean;
  /** Enable guided profiling workflows */
  enableGuidedWorkflows: boolean;
  /** Enable performance monitor panel */
  enablePerfMonitor: boolean;
}

const STORAGE_KEY = 'feature_flags';

const DEFAULT_FLAGS: FeatureFlags = {
  enable3DVisualization: true,
  enableAISuggestions: true,
  enableCloudSync: true,
  enableCollaboration: true,
  enableMarketplace: false,
  enableRSCAnalysis: true,
  enablePerfBudgets: true,
  enableGuidedWorkflows: true,
  enablePerfMonitor: true,
};

let cached: FeatureFlags | null = null;

function applyEnvOverrides(flags: FeatureFlags): FeatureFlags {
  if (import.meta.env.VITE_DISABLE_GOOGLE_DRIVE_SYNC === 'true') {
    // Existing env var pattern — keep backward compat
  }
  return flags;
}

export async function loadFeatureFlags(): Promise<FeatureFlags> {
  if (cached) return cached;

  let flags = { ...DEFAULT_FLAGS };

  if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
    const stored = await new Promise<Record<string, boolean> | undefined>(
      (resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
          resolve(result[STORAGE_KEY] as Record<string, boolean> | undefined);
        });
      }
    );

    if (stored) {
      for (const [key, value] of Object.entries(stored)) {
        if (key in flags) {
          (flags as Record<string, boolean>)[key] = value;
        }
      }
    }
  }

  flags = applyEnvOverrides(flags);
  cached = flags;
  return flags;
}

export function getFeatureFlags(): FeatureFlags {
  return cached ?? DEFAULT_FLAGS;
}

export async function setFeatureFlag<K extends keyof FeatureFlags>(
  key: K,
  value: FeatureFlags[K]
): Promise<void> {
  if (!cached) await loadFeatureFlags();
  cached![key] = value;

  if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
    const overrides: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(cached!)) {
      if (v !== DEFAULT_FLAGS[k as keyof FeatureFlags]) {
        overrides[k] = v;
      }
    }
    chrome.storage.local.set({ [STORAGE_KEY]: overrides });
  }
}

export function isFeatureEnabled(key: keyof FeatureFlags): boolean {
  return cached?.[key] ?? DEFAULT_FLAGS[key];
}
