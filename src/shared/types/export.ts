/**
 * Export types for React Perf Profiler
 * Defines versioned export schemas for profile data with compression and metadata support
 * @module shared/types/export
 */

import type { AnalysisResult, CommitData, FiberNode } from '../types';
import type { RSCPayload, RSCAnalysisResult } from './rsc';
import { version as PACKAGE_VERSION } from '../../../package.json';

/**
 * Current export format version
 * Increment when making breaking changes to export format
 */
export const CURRENT_EXPORT_VERSION = '1.0';

/**
 * Supported export format versions
 */
export const SUPPORTED_EXPORT_VERSIONS = ['1.0', '1.1', '2.0'] as const;

/**
 * Export format version type
 */
export type ExportVersion = typeof SUPPORTED_EXPORT_VERSIONS[number];

/**
 * Export file format types
 */
export type ExportFormat = 'json' | 'csv' | 'html';

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
  format: 'react-perf-profiler-v1' | 'react-perf-profiler-v2';
  /** Source URL where profiling occurred (if available) */
  sourceUrl?: string;
  /** Export file name (optional) */
  fileName?: string;
  /** User agent string */
  userAgent?: string;
  /** Platform information */
  platform?: string;
  /** Screen dimensions */
  screenDimensions?: {
    width: number;
    height: number;
  };
  /** Total export size in bytes (before compression) */
  exportSize?: number;
  /** Compression info */
  compression?: {
    algorithm: 'gzip' | 'deflate' | 'none';
    originalSize: number;
    compressedSize: number;
  };
  /** Optional screenshot/thumbnail as base64 data URL */
  thumbnail?: string;
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
 * Future exported profile data structure (v2.0)
 * Placeholder for future schema evolution
 */
export interface ExportedProfileV2 {
  /** Export format version */
  version: '2.0';
  /** Export metadata */
  metadata: ExportMetadata;
  /** Profile data payload with enhanced structure */
  data: {
    /** Array of captured commits with enhanced metrics */
    commits: CommitData[];
    /** Analysis results (if available) */
    analysisResults?: AnalysisResult;
    /** RSC payloads (if available) */
    rscPayloads?: RSCPayload[];
    /** RSC analysis results (if available) */
    rscAnalysis?: RSCAnalysisResult;
    /** New in v2.0: Component relationships graph */
    componentGraph?: {
      nodes: Array<{ id: string; name: string }>;
      edges: Array<{ source: string; target: string; type: string }>;
    };
    /** New in v2.0: Performance timeline data */
    performanceTimeline?: Array<{
      timestamp: number;
      metric: string;
      value: number;
    }>;
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
export type ExportedProfile = ExportedProfileV1 | ExportedProfileV2 | ExportedProfileLegacy;

/**
 * Type guard to check if profile is v1 format
 */
export function isExportedProfileV1(profile: unknown): profile is ExportedProfileV1 {
  if (typeof profile !== 'object' || profile === null) return false;
  const p = profile as Record<string, unknown>;
  return (
    p['version'] === '1.0' &&
    typeof p['metadata'] === 'object' &&
    p['metadata'] !== null &&
    typeof (p['metadata'] as ExportMetadata).profilerVersion === 'string' &&
    typeof (p['metadata'] as ExportMetadata).exportedAt === 'string' &&
    typeof p['data'] === 'object' &&
    p['data'] !== null
  );
}

/**
 * Type guard to check if profile is v2 format
 */
export function isExportedProfileV2(profile: unknown): profile is ExportedProfileV2 {
  if (typeof profile !== 'object' || profile === null) return false;
  const p = profile as Record<string, unknown>;
  return (
    p['version'] === '2.0' &&
    typeof p['metadata'] === 'object' &&
    p['metadata'] !== null &&
    typeof (p['metadata'] as ExportMetadata).profilerVersion === 'string' &&
    typeof (p['metadata'] as ExportMetadata).exportedAt === 'string' &&
    typeof p['data'] === 'object' &&
    p['data'] !== null
  );
}

/**
 * Type guard to check if profile is legacy format
 */
export function isExportedProfileLegacy(profile: unknown): profile is ExportedProfileLegacy {
  if (typeof profile !== 'object' || profile === null) return false;
  const p = profile as Record<string, unknown>;
  return (
    (p['version'] === undefined || typeof p['version'] === 'number') &&
    Array.isArray(p['commits'])
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
  /** File metadata */
  fileInfo?: {
    name: string;
    size: number;
    compressed?: boolean;
  };
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
  /** Total recording duration in ms */
  recordingDuration?: number;
  /** Number of components */
  componentCount?: number;
  /** Total export size */
  exportSize?: number;
  /** Source URL */
  sourceUrl?: string;
}

/**
 * Migration function type
 */
export type MigrationFunction = (
  profile: ExportedProfile,
  fromVersion: string,
  toVersion: string
) => ExportedProfile;

/**
 * Migration log entry
 */
export interface MigrationLogEntry {
  /** Timestamp of the migration step */
  timestamp: string;
  /** From version */
  fromVersion: string;
  /** To version */
  toVersion: string;
  /** Step description */
  description: string;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Migration result with logging
 */
export interface MigrationResult {
  /** Migrated profile */
  profile: ExportedProfile;
  /** Whether migration was performed */
  migrated: boolean;
  /** Migration log */
  log: MigrationLogEntry[];
  /** Source version */
  fromVersion: string;
  /** Target version */
  toVersion: string;
}

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
  migrateFrom?: (profile: unknown) => ExportedProfile;
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
 * Export options
 */
export interface ExportOptions {
  /** Include analysis results */
  includeAnalysis?: boolean;
  /** Include RSC data */
  includeRSC?: boolean;
  /** Include screenshot/thumbnail */
  includeThumbnail?: boolean;
  /** Compress export if over threshold */
  compress?: boolean;
  /** Compression threshold in bytes */
  compressionThreshold?: number;
  /** Export format */
  format?: ExportFormat;
  /** Source URL */
  sourceUrl?: string;
  /** Custom file name */
  fileName?: string;
}

/**
 * CSV export row structure
 */
export interface CSVExportRow {
  commitId: string;
  timestamp: number;
  componentName: string;
  actualDuration: number;
  baseDuration: number;
  isMemoized: boolean;
  wastedRender: boolean;
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
export function validateImportData(
  data: unknown,
  fileInfo?: { name: string; size: number; compressed?: boolean }
): ImportValidationResult {
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

  // Check for commits (required in all versions)
  let commits: CommitData[] | undefined;
  
  if (isExportedProfileV1(data)) {
    commits = data.data.commits;
  } else if (isExportedProfileV2(data)) {
    commits = data.data.commits;
  } else if (isExportedProfileLegacy(data)) {
    commits = data.commits;
  }

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
  let rawVersion: string | number | undefined;
  
  if (isExportedProfileV1(data)) {
    version = data.version;
    rawVersion = data.version;
  } else if (isExportedProfileV2(data)) {
    version = data.version;
    rawVersion = data.version;
  } else if (isExportedProfileLegacy(data)) {
    version = data.version !== undefined ? `legacy-${data.version}` : 'legacy';
    rawVersion = data.version;
  } else {
    version = 'unknown';
    rawVersion = undefined;
  }

  const compatibility = getVersionCompatibility(rawVersion);

  // Extract preview data
  let preview: ImportPreview;
  if (isExportedProfileV1(data) || isExportedProfileV2(data)) {
    preview = {
      version: data.version,
      commitCount: data.data.commits.length,
      exportedAt: data.metadata.exportedAt,
      profilerVersion: data.metadata.profilerVersion,
      reactVersion: data.metadata.reactVersion,
      hasAnalysis: !!data.data.analysisResults,
      hasRSCData: !!(data.data.rscPayloads?.length),
      recordingDuration: data.recordingDuration,
      exportSize: data.metadata.exportSize,
      sourceUrl: data.metadata.sourceUrl,
    };
  } else {
    // Legacy format
    const legacyData = data as ExportedProfileLegacy;
    preview = {
      version: legacyData.version !== undefined ? String(legacyData.version) : 'legacy',
      commitCount: legacyData.commits.length,
      exportedAt: 'unknown',
      profilerVersion: 'unknown',
      hasAnalysis: false,
      hasRSCData: !!(legacyData.rscPayloads?.length),
      recordingDuration: legacyData.recordingDuration,
    };
  }

  // Count unique components
  const componentNames = new Set<string>();
  for (const commit of commits) {
    if (commit.nodes) {
      for (const node of commit.nodes) {
        if (node.displayName) {
          componentNames.add(node.displayName);
        }
      }
    }
  }
  preview.componentCount = componentNames.size;

  return {
    isValid: compatibility.canImport,
    version,
    isSupported: !compatibility.needsMigration,
    migrationAvailable: compatibility.needsMigration && compatibility.migrateTo !== undefined,
    migrationTarget: compatibility.migrateTo,
    error: compatibility.canImport ? undefined : compatibility.warning,
    warning: compatibility.canImport ? compatibility.warning : undefined,
    preview,
    fileInfo,
  };
}

/**
 * Simplified export data structure for internal use
 */
export interface ExportData {
  version: string;
  exportedAt: number;
  commits: CommitData[];
  componentData: Record<string, unknown>;
  analysisResults?: AnalysisResult;
  wastedRenderReports?: unknown[];
  performanceScore?: number | null;
  settings?: Record<string, unknown>;
  metadata: {
    totalCommits: number;
    totalComponents: number;
    exportDuration: number;
    userAgent: string;
    url: string;
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
    fileName?: string;
    includeThumbnail?: boolean;
  } = {}
): ExportedProfileV1 {
  const now = new Date().toISOString();

  // Calculate export size estimate
  const exportSizeEstimate = JSON.stringify({ commits }).length * 2; // Rough estimate

  return {
    version: '1.0',
    metadata: {
      profilerVersion: PACKAGE_VERSION,
      reactVersion: options.reactVersion ?? 'unknown',
      exportedAt: now,
      format: 'react-perf-profiler-v1',
      sourceUrl: options.sourceUrl,
      fileName: options.fileName,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
      screenDimensions:
        typeof window !== 'undefined'
          ? {
              width: window.screen.width,
              height: window.screen.height,
            }
          : undefined,
      exportSize: exportSizeEstimate,
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

/**
 * Determine whether a fiber node represents a wasted render.
 * A render is wasted when props and state are shallowly equal to the previous
 * render and no context change occurred — meaning the component re-rendered
 * unnecessarily.
 */
function isNodeWastedRender(node: FiberNode): boolean {
  // First render (no previous props/state) can never be wasted
  if (node.prevProps === undefined && node.prevState === undefined) return false;
  if (node.hasContextChanged) return false;

  const prevProps = node.prevProps ?? {};
  const currProps = node.props ?? {};
  const prevState = node.prevState ?? {};
  const currState = node.state ?? {};

  const propsKeys = new Set([...Object.keys(prevProps), ...Object.keys(currProps)]);
  const propsEqual = [...propsKeys].every((k) => Object.is(prevProps[k], currProps[k]));
  if (!propsEqual) return false;

  const stateKeys = new Set([...Object.keys(prevState), ...Object.keys(currState)]);
  const stateEqual = [...stateKeys].every((k) => Object.is(prevState[k], currState[k]));
  return stateEqual;
}

/**
 * Create CSV export from profile data
 */
export function createCSVExport(commits: CommitData[]): string {
  const rows: CSVExportRow[] = [];

  for (const commit of commits) {
    for (const node of commit.nodes ?? []) {
      rows.push({
        commitId: commit.id,
        timestamp: commit.timestamp,
        componentName: node.displayName,
        actualDuration: node.actualDuration,
        baseDuration: node.baseDuration,
        isMemoized: node.isMemoized,
        wastedRender: isNodeWastedRender(node),
      });
    }
  }

  // Create CSV header
  const headers = [
    'Commit ID',
    'Timestamp',
    'Component Name',
    'Actual Duration (ms)',
    'Base Duration (ms)',
    'Is Memoized',
    'Wasted Render',
  ];

  // Create CSV rows
  const csvRows = rows.map((row) =>
    [
      row.commitId,
      row.timestamp,
      `"${row.componentName}"`,
      row.actualDuration.toFixed(3),
      row.baseDuration.toFixed(3),
      row.isMemoized ? 'Yes' : 'No',
      row.wastedRender ? 'Yes' : 'No',
    ].join(',')
  );

  return [headers.join(','), ...csvRows].join('\n');
}

/**
 * Create HTML report from profile data
 */
export function createHTMLExport(
  commits: CommitData[],
  analysisResults?: AnalysisResult,
  options: { title?: string; reactVersion?: string } = {}
): string {
  const title = options.title ?? 'React Perf Profiler Report';
  const totalDuration = commits.reduce((sum, c) => sum + c.duration, 0);
  const componentCount = new Set(commits.flatMap((c) => c.nodes?.map((n) => n.displayName) ?? [])).size;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 30px;
    }
    h1 { color: #61dafb; margin-bottom: 10px; }
    .subtitle { color: #666; margin-bottom: 30px; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 6px;
      border-left: 4px solid #61dafb;
    }
    .stat-value {
      font-size: 28px;
      font-weight: bold;
      color: #333;
    }
    .stat-label {
      color: #666;
      font-size: 14px;
      margin-top: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th, td {
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid #eee;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #555;
    }
    tr:hover { background: #f8f9fa; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-memoized { background: #d4edda; color: #155724; }
    .badge-not-memoized { background: #f8d7da; color: #721c24; }
    .timestamp { color: #999; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚛️ ${title}</h1>
    <p class="subtitle">Generated on ${new Date().toLocaleString()}</p>
    
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${commits.length}</div>
        <div class="stat-label">Total Commits</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${componentCount}</div>
        <div class="stat-label">Unique Components</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalDuration.toFixed(2)}ms</div>
        <div class="stat-label">Total Duration</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${options.reactVersion ?? 'Unknown'}</div>
        <div class="stat-label">React Version</div>
      </div>
    </div>

    <h2>Commits</h2>
    <table>
      <thead>
        <tr>
          <th>Commit ID</th>
          <th>Time</th>
          <th>Duration</th>
          <th>Components</th>
          <th>Priority</th>
        </tr>
      </thead>
      <tbody>
        ${commits
          .map(
            (commit) => `
          <tr>
            <td>${commit.id.slice(0, 8)}...</td>
            <td class="timestamp">${new Date(commit.timestamp).toLocaleTimeString()}</td>
            <td>${commit.duration.toFixed(2)}ms</td>
            <td>${commit.nodes?.length ?? 0}</td>
            <td>${commit.priorityLevel}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    ${
      analysisResults
        ? `
    <h2>Analysis Results</h2>
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${analysisResults.performanceScore}</div>
        <div class="stat-label">Performance Score</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${analysisResults.wastedRenderReports.length}</div>
        <div class="stat-label">Wasted Render Issues</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${analysisResults.memoReports.length}</div>
        <div class="stat-label">Memo Issues</div>
      </div>
    </div>
    `
        : ''
    }
  </div>
</body>
</html>`;
}
