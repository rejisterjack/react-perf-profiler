/**
 * RSC Version Detection Utilities
 * Detects React version and determines RSC feature support,
 * enabling graceful degradation in the panel UI.
 */

/** Minimum React version that ships RSC support */
const RSC_MIN_MAJOR = 18;
const RSC_MIN_MINOR = 0;

export interface ParsedReactVersion {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

export interface RSCSupportStatus {
  /** Whether RSC is supported by the detected React version */
  supported: boolean;
  /**
   * Human-readable reason explaining the support status.
   * Displayed in the UI when RSC data is unavailable.
   */
  reason: string;
  /** Parsed version components, null if version string was unparseable */
  version: ParsedReactVersion | null;
}

/**
 * Parse a React version string into its numeric components.
 * Handles semver strings like "18.2.0", "19.0.0-rc.1", "18.3.0-canary.abc123".
 */
export function parseReactVersion(raw: string): ParsedReactVersion | null {
  if (!raw || raw === 'unknown') return null;

  // Strip any pre-release suffix (e.g. "-rc.1", "-canary.abc")
  const clean = raw.split('-')[0] ?? '';
  const parts = clean.split('.').map(Number);

  const [major = Number.NaN, minor = Number.NaN, patch = Number.NaN] = parts;
  if (Number.isNaN(major) || Number.isNaN(minor)) return null;

  return { major, minor, patch: Number.isNaN(patch) ? 0 : patch, raw };
}

/**
 * Determine whether a React version supports RSC.
 * RSC is available from React 18.0.0 onward.
 */
export function checkRSCSupport(reactVersion: string | undefined): RSCSupportStatus {
  const raw = reactVersion ?? 'unknown';
  const version = parseReactVersion(raw);

  if (!version) {
    return {
      supported: false,
      reason:
        'React version could not be detected. RSC analysis is available in React 18 and later.',
      version: null,
    };
  }

  const meetsMinimum =
    version.major > RSC_MIN_MAJOR ||
    (version.major === RSC_MIN_MAJOR && version.minor >= RSC_MIN_MINOR);

  if (!meetsMinimum) {
    return {
      supported: false,
      reason: `React Server Components require React ${RSC_MIN_MAJOR}.${RSC_MIN_MINOR}+. Detected React ${version.raw}.`,
      version,
    };
  }

  return {
    supported: true,
    reason: `React ${version.raw} supports RSC.`,
    version,
  };
}
