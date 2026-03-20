/**
 * Export types for React Perf Profiler
 * Defines versioned export schemas for profile data
 * @module shared/types/export
 */

import type { CommitData, AnalysisResult } from '../types';
import type { RSCPayload, RSCAnalysisResult } from './rsc';

/**
 * Current export format version
 * Increment when making breaking changes to export format
 */
export const CURRENT_EXPORT_VERSION = '1.0';

/**
 * Supported export format versions
 */
export const SUPPORTED_EXPORT_VERSIONS = ['1.0'] as const;

/**
 * Export format version type
 */
export type ExportVersion = typeof SUPPORTED_EXPORT_VERSIONS[number];

/**
 * Metadata for exported profile data
 */
export interface ExportMetadata {
  /** Profiler extension version */
  profilerVersion: string;
  /** React version detected during profiling */
  reactVersion: string;
  /** ISO timestamp when exported */
  exportedAt: string;
  /** Format identifier for validation */
  format: 'react-perf-profiler-v1';
  /** Source URL where profiling occurred (if available) */
  sourceUrl?: string;
}

/**
 * Exported profile data structure (v1.0)
 */
export interface ExportedProfileV1 {
  /** Export format version */
  version: '1.0';
  /** Export metadata */
  metadata: ExportMetadata;
  /** Profile data payload */
  data: {
    /** Array of captured commits */
    commits: CommitData[];
    /** Analysis results (if available) */
    analysisResults?: AnalysisResult;
    /** RSC payloads (if available) */
    rscPayloads?: RSCPayload[];
    /** RSC analysis results (if available) */
    rscAnalysis?: RSCAnalysisResult;
  };
  /** Recording duration in milliseconds */
  recordingDuration: number;
}

/**
 * Legacy exported profile (versionless, for backward compatibility)
 */
export interface ExportedProfileLegacy {
  /** Version number (number format for legacy) */
  version?: number;
  /** Direct commits array (legacy structure) */
  commits: CommitData[];
  /** Recording duration */
  recordingDuration: number;
  /** Legacy RSC payloads */
  rscPayloads?: RSCPayload[];
  /** Legacy RSC analysis */
  rscAnalysis?: RSCAnalysisResult;
}

/**
 * Union type for all supported export schemas
 */
export type ExportedProfile = ExportedProfileV1 | ExportedProfileLegacy;

/**
 * Type guard to check if profile is v1 format
 */
export function isExportedProfileV1(profile: unknown): profile is ExportedProfileV1 {
  if (typeof profile !== 'object' || profile === null) return false;
  const p = profile as Record<string, unknown>;
  return (
    p.version === '1.0' &&
    typeof p.metadata === 'object' &&
    p.metadata !== null &&
    typeof (p.metadata as ExportMetadata).profilerVersion === 'string' &&
    typeof (p.metadata as ExportMetadata).exportedAt === 'string' &&
    typeof p.data === 'object' &&
    p.data !== null
  );
}

/**
 * Type guard to check if profile is legacy format
 */
export function isExportedProfileLegacy(profile: unknown): profile is ExportedProfileLegacy {
  if (typeof profile !== 'object' || profile === null) return false;
  const p = profile as Record<string, unknown>;
  return (
    (p.version === undefined || typeof p.version === 'number') &&
    Array.isArray(p.commits)
  );
}

/**
 * Validation result for import operations
 */
export interface ImportValidationResult {
  /** Whether the import is valid */
  isValid: boolean;
  /** Detected version */
  version: string;
  /** Whether this version is supported */
  isSupported: boolean;
  /** Whether migration is available */
  migrationAvailable: boolean;
  /** Target version for migration (if available) */
  migrationTarget?: string;
  /** Error message if invalid */
  error?: string;
  /** Warning message (e.g., for version mismatch) */
  warning?: string;
  /** Preview data */
  preview?: ImportPreview;
}

/**
 * Preview data for import dialog
 */
export interface ImportPreview {
  /** Export format version */
  version: string;
  /** Number of commits */
  commitCount: number;
  /** Export timestamp */
  exportedAt: string;
  /** Profiler version */
  profilerVersion: string;
  /** React version */
  reactVersion?: string;
  /** Whether analysis results are included */
  hasAnalysis: boolean;
  /** Whether RSC data is included */
  hasRSCData: boolean;
}

/**
 * Migration function type
 */
export type MigrationFunction = (
  profile: ExportedProfile,
  fromVersion: string,
  toVersion: string
) => ExportedProfileV1;

/**
 * Schema definition for export validation
 */
export interface ExportSchema {
  /** Schema version */
  version: string;
  /** Required fields */
  required: string[];
  /** Optional fields */
  optional: string[];
  /** Field types for validation */
  fieldTypes: Record<string, string>;
  /** Migration from previous version (if applicable) */
  migrateFrom?: (profile: unknown) => ExportedProfileV1;
}

/**
 * Version compatibility info
 */
export interface VersionCompatibility {
  /** Version string */
  version: string;
  /** Whether this version can be imported */
  canImport: boolean;
  /** Whether migration is needed */
  needsMigration: boolean;
  /** Target version for migration */
  migrateTo?: string;
  /** Warning message */
  warning?: string;
}

/**
 * Check if a version is supported
 */
export function isVersionSupported(version: string): boolean {
  return SUPPORTED_EXPORT_VERSIONS.includes(version as ExportVersion);
}

/**
 * Get version compatibility information
 */
export function getVersionCompatibility(version: string | number | undefined): VersionCompatibility {
  // Handle legacy version (number or undefined)
  if (version === undefined) {
    return {
      version: 'legacy',
      canImport: true,
      needsMigration: true,
      migrateTo: CURRENT_EXPORT_VERSION,
      warning: 'Legacy format detected. Data will be migrated to the current format.',
    };
  }

  if (typeof version === 'number') {
    return {
      version: `legacy-${version}`,
      canImport: true,
      needsMigration: true,
      migrateTo: CURRENT_EXPORT_VERSION,
      warning: `Legacy format v${version} detected. Data will be migrated to the current format.`,
    };
  }

  // Handle current versions
  if (isVersionSupported(version)) {
    return {
      version,
      canImport: true,
      needsMigration: false,
    };
  }

  // Handle unknown versions
  return {
    version: String(version),
    canImport: false,
    needsMigration: false,
    warning: `Unsupported format version: ${version}. Please update the profiler to import this file.`,
  };
}

/**
 * Validate import data and return validation result
 */
export function validateImportData(data: unknown): ImportValidationResult {
  // Check if it's a valid object
  if (typeof data !== 'object' || data === null) {
    return {
      isValid: false,
      version: 'unknown',
      isSupported: false,
      migrationAvailable: false,
      error: 'Invalid file format: expected JSON object',
    };
  }

  const profile = data as Record<string, unknown>;

  // Check for commits (required in all versions)
  const commits = isExportedProfileV1(profile) 
    ? profile.data.commits 
    : (profile as ExportedProfileLegacy).commits;
    
  if (!commits || !Array.isArray(commits)) {
    return {
      isValid: false,
      version: 'unknown',
      isSupported: false,
      migrationAvailable: false,
      error: 'Invalid file format: missing commits array',
    };
  }

  // Determine version and compatibility
  let version: string;
  if (isExportedProfileV1(profile)) {
    version = profile.version;
  } else if (isExportedProfileLegacy(profile)) {
    version = profile.version !== undefined ? `legacy-${profile.version}` : 'legacy';
  } else {
    version = 'unknown';
  }

  const compatibility = getVersionCompatibility(
    isExportedProfileV1(profile) ? profile.version : profile.version
  );

  // Extract preview data
  let preview: ImportPreview;
  if (isExportedProfileV1(profile)) {
    preview = {
      version: profile.version,
      commitCount: profile.data.commits.length,
      exportedAt: profile.metadata.exportedAt,
      profilerVersion: profile.metadata.profilerVersion,
      reactVersion: profile.metadata.reactVersion,
      hasAnalysis: !!profile.data.analysisResults,
      hasRSCData: !!(profile.data.rscPayloads?.length),
    };
  } else {
    const legacyProfile = profile as ExportedProfileLegacy;
    preview = {
      version: legacyProfile.version !== undefined ? String(legacyProfile.version) : 'legacy',
      commitCount: legacyProfile.commits.length,
      exportedAt: 'unknown',
      profilerVersion: 'unknown',
      hasAnalysis: false,
      hasRSCData: !!(legacyProfile.rscPayloads?.length),
    };
  }

  return {
    isValid: compatibility.canImport,
    version,
    isSupported: !compatibility.needsMigration,
    migrationAvailable: compatibility.needsMigration && compatibility.migrateTo !== undefined,
    migrationTarget: compatibility.migrateTo,
    error: compatibility.canImport ? undefined : compatibility.warning,
    warning: compatibility.canImport ? compatibility.warning : undefined,
    preview,
  };
}

/**
 * Create a new v1 export profile from store data
 */
export function createExportProfile(
  commits: CommitData[],
  recordingDuration: number,
  options: {
    reactVersion?: string;
    analysisResults?: AnalysisResult;
    rscPayloads?: RSCPayload[];
    rscAnalysis?: RSCAnalysisResult;
    sourceUrl?: string;
  } = {}
): ExportedProfileV1 {
  const now = new Date().toISOString();
  
  return {
    version: '1.0',
    metadata: {
      profilerVersion: '1.0.0', // TODO: Get from package.json
      reactVersion: options.reactVersion ?? 'unknown',
      exportedAt: now,
      format: 'react-perf-profiler-v1',
      sourceUrl: options.sourceUrl,
    },
    data: {
      commits,
      analysisResults: options.analysisResults,
      rscPayloads: options.rscPayloads,
      rscAnalysis: options.rscAnalysis,
    },
    recordingDuration,
  };
}
