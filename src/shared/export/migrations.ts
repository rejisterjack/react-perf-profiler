/**
 * Migration utilities for profile export versions
 * Handles conversion between different export format versions
 * @module shared/export/migrations
 */

import type {
  ExportedProfileV1,
  ExportedProfileLegacy,
  MigrationFunction,
} from '@/shared/types/export';
import type { CommitData, AnalysisResult } from '@/shared/types';
import type { RSCPayload, RSCAnalysisResult } from '@/shared/types/rsc';

/**
 * Migration error class
 */
export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly fromVersion: string,
    public readonly toVersion: string
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * Registry of available migrations
 * Maps source version to migration function
 */
const migrationRegistry: Map<string, MigrationFunction> = new Map();

/**
 * Register a migration function
 */
export function registerMigration(
  fromVersion: string,
  toVersion: string,
  migrateFn: MigrationFunction
): void {
  const key = `${fromVersion}→${toVersion}`;
  migrationRegistry.set(key, migrateFn);
}

/**
 * Get migration function for version transition
 */
export function getMigration(
  fromVersion: string,
  toVersion: string
): MigrationFunction | undefined {
  const key = `${fromVersion}→${toVersion}`;
  return migrationRegistry.get(key);
}

/**
 * Check if migration is available
 */
export function isMigrationAvailable(fromVersion: string, toVersion: string): boolean {
  return getMigration(fromVersion, toVersion) !== undefined;
}

/**
 * Migrate legacy profile (versionless or number version) to v1.0
 */
export function migrateLegacyToV1(
  profile: ExportedProfileLegacy,
  fromVersion: string,
  toVersion: string
): ExportedProfileV1 {
  if (toVersion !== '1.0') {
    throw new MigrationError(
      `Target version ${toVersion} not supported. Only v1.0 is supported.`,
      fromVersion,
      toVersion
    );
  }

  // Extract data from legacy format
  const commits: CommitData[] = profile.commits || [];
  const recordingDuration = profile.recordingDuration ?? 0;
  const rscPayloads = profile.rscPayloads;
  const rscAnalysis = profile.rscAnalysis;

  // Try to extract React version from commits
  const reactVersion = commits[0]?.reactVersion ?? 'unknown';

  return {
    version: '1.0',
    metadata: {
      profilerVersion: '1.0.0',
      reactVersion,
      exportedAt: new Date().toISOString(),
      format: 'react-perf-profiler-v1',
    },
    data: {
      commits,
      analysisResults: undefined, // Legacy format doesn't have structured analysis
      rscPayloads,
      rscAnalysis,
    },
    recordingDuration,
  };
}

/**
 * Migrate profile from one version to another
 */
export function migrateProfile(
  profile: unknown,
  fromVersion: string | number | undefined,
  toVersion: string = '1.0'
): ExportedProfileV1 {
  // Determine source version string
  const sourceVersion = fromVersion === undefined 
    ? 'legacy' 
    : typeof fromVersion === 'number' 
      ? `legacy-${fromVersion}` 
      : fromVersion;

  // Check if already at target version
  if (sourceVersion === toVersion) {
    return profile as ExportedProfileV1;
  }

  // Try to find specific migration
  const migration = getMigration(sourceVersion, toVersion);
  if (migration) {
    return migration(profile as ExportedProfileV1, sourceVersion, toVersion);
  }

  // Handle legacy formats with the generic legacy migration
  if (sourceVersion.startsWith('legacy') || sourceVersion === 'legacy') {
    return migrateLegacyToV1(profile as ExportedProfileLegacy, sourceVersion, toVersion);
  }

  // No migration available
  throw new MigrationError(
    `No migration available from ${sourceVersion} to ${toVersion}`,
    sourceVersion,
    toVersion
  );
}

/**
 * Auto-migrate profile to current version
 * Detects version and applies appropriate migration
 */
export function autoMigrateProfile(profile: unknown): ExportedProfileV1 {
  if (typeof profile !== 'object' || profile === null) {
    throw new MigrationError('Invalid profile: expected object', 'unknown', '1.0');
  }

  const p = profile as Record<string, unknown>;

  // Detect version
  let fromVersion: string | number | undefined;
  
  if (p.version === '1.0') {
    // Already v1, return as-is
    return profile as ExportedProfileV1;
  } else if (typeof p.version === 'number') {
    fromVersion = p.version;
  } else if (p.version === undefined) {
    fromVersion = undefined;
  } else {
    fromVersion = String(p.version);
  }

  return migrateProfile(profile, fromVersion, '1.0');
}

/**
 * Validate that migrated profile is complete
 */
export function validateMigratedProfile(profile: ExportedProfileV1): boolean {
  return (
    profile.version === '1.0' &&
    typeof profile.metadata === 'object' &&
    profile.metadata !== null &&
    typeof profile.metadata.profilerVersion === 'string' &&
    typeof profile.metadata.exportedAt === 'string' &&
    Array.isArray(profile.data?.commits) &&
    typeof profile.recordingDuration === 'number'
  );
}

/**
 * Migration from v1.0 to future v1.1 (example/template)
 * This is a placeholder for future migrations
 */
function migrateV1ToV1_1(
  profile: ExportedProfileV1,
  fromVersion: string,
  toVersion: string
): ExportedProfileV1 {
  // Example: Add new optional field with default value
  return {
    ...profile,
    version: '1.1' as const,
    metadata: {
      ...profile.metadata,
      // Add any new metadata fields here
    },
    data: {
      ...profile.data,
      // Add any new data fields here
    },
  };
}

// Register migrations
registerMigration('legacy', '1.0', migrateLegacyToV1);
registerMigration('legacy-1', '1.0', migrateLegacyToV1);

// Register example future migration (currently commented out until v1.1 exists)
// registerMigration('1.0', '1.1', migrateV1ToV1_1);

/**
 * Get list of available migrations
 */
export function getAvailableMigrations(): Array<{
  from: string;
  to: string;
  available: boolean;
}> {
  return Array.from(migrationRegistry.keys()).map((key) => {
    const [from, to] = key.split('→');
    return { from: from ?? '', to: to ?? '', available: true };
  });
}

/**
 * Get migration path for a version
 * Returns array of migration steps needed
 */
export function getMigrationPath(
  fromVersion: string,
  toVersion: string
): string[] | null {
  // Direct migration available
  if (isMigrationAvailable(fromVersion, toVersion)) {
    return [fromVersion, toVersion];
  }

  // Check for multi-step migration paths
  // For example: legacy → 1.0 → 1.1 → 2.0
  const versions = ['legacy', 'legacy-1', '1.0'];
  const fromIndex = versions.indexOf(fromVersion);
  const toIndex = versions.indexOf(toVersion);

  if (fromIndex !== -1 && toIndex !== -1 && fromIndex < toIndex) {
    return versions.slice(fromIndex, toIndex + 1);
  }

  return null;
}
