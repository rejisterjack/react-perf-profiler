/**
 * Migration utilities for profile export versions
 * Handles conversion between different export format versions with logging and error handling
 * @module shared/export/migrations
 */

import type {
  ExportedProfileV1,
  ExportedProfileLegacy,
  ExportedProfile,
  MigrationFunction,
  MigrationLogEntry,
  MigrationResult,
} from '@/shared/types/export';
import type { CommitData } from '@/shared/types';

/**
 * Migration error class
 */
export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly fromVersion: string,
    public readonly toVersion: string,
    public readonly log?: MigrationLogEntry[]
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * Corrupted profile error class
 */
export class CorruptedProfileError extends Error {
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CorruptedProfileError';
  }
}

/**
 * Registry of available migrations
 * Maps source version to migration function
 */
const migrationRegistry: Map<string, MigrationFunction> = new Map();

/**
 * Migration statistics for telemetry
 */
const migrationStats = {
  totalMigrations: 0,
  successfulMigrations: 0,
  failedMigrations: 0,
  lastMigration: null as MigrationLogEntry[] | null,
};

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
 * Get migration path for multi-step migrations
 * Returns array of version steps needed to reach target
 */
export function getMigrationPath(fromVersion: string, toVersion: string): string[] | null {
  // Direct migration available
  if (isMigrationAvailable(fromVersion, toVersion)) {
    return [fromVersion, toVersion];
  }

  // Define known migration chains
  const migrationChains: Record<string, string[]> = {
    legacy: ['legacy', '1.0'],
    'legacy-0': ['legacy-0', '1.0'],
    'legacy-1': ['legacy-1', '1.0'],
  };

  // Check if there's a known chain
  const chain = migrationChains[fromVersion];
  if (chain && chain.includes(toVersion)) {
    const fromIndex = chain.indexOf(fromVersion);
    const toIndex = chain.indexOf(toVersion);
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex < toIndex) {
      return chain.slice(fromIndex, toIndex + 1);
    }
  }

  // Future: v1.0 -> v2.0 chain
  if (fromVersion === '1.0' && toVersion === '2.0') {
    // This will be enabled when v2 migration is implemented
    return null;
  }

  return null;
}

/**
 * Create a migration log entry
 */
function createLogEntry(
  fromVersion: string,
  toVersion: string,
  description: string,
  success: boolean,
  error?: string
): MigrationLogEntry {
  return {
    timestamp: new Date().toISOString(),
    fromVersion,
    toVersion,
    description,
    success,
    error,
  };
}

/**
 * Validate that profile data is not corrupted
 */
function validateProfileIntegrity(profile: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof profile !== 'object' || profile === null) {
    return { valid: false, errors: ['Profile is not a valid object'] };
  }

  const p = profile as Record<string, unknown>;

  // Check for required fields in all versions
  const dataField = p['data'] as Record<string, unknown> | undefined;
  const commits = (dataField?.['commits'] as CommitData[]) || (p['commits'] as CommitData[]);

  if (!Array.isArray(commits)) {
    errors.push('Missing or invalid commits array');
  } else {
    // Validate each commit
    for (let i = 0; i < Math.min(commits.length, 10); i++) {
      const commit = commits[i];
      if (typeof commit !== 'object' || commit === null) {
        errors.push(`Commit ${i} is not a valid object`);
        continue;
      }
      const c = commit as unknown as Record<string, unknown>;
      if (!c['id']) errors.push(`Commit ${i} is missing id`);
      if (typeof c['timestamp'] !== 'number') errors.push(`Commit ${i} has invalid timestamp`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Migrate legacy profile (versionless or number version) to v1.0
 */
export function migrateLegacyToV1(
  profile: ExportedProfile,
  fromVersion: string,
  toVersion: string
): ExportedProfileV1 {
  const legacyProfile = profile as unknown as ExportedProfileLegacy;
  if (toVersion !== '1.0') {
    throw new MigrationError(
      `Target version ${toVersion} not supported. Only v1.0 is supported.`,
      fromVersion,
      toVersion
    );
  }

  // Validate profile integrity
  const integrity = validateProfileIntegrity(profile);
  if (!integrity.valid) {
    throw new CorruptedProfileError(
      `Profile integrity check failed: ${integrity.errors.join(', ')}`,
      { errors: integrity.errors }
    );
  }

  // Extract data from legacy format
  const commits: CommitData[] = legacyProfile.commits || [];
  const recordingDuration = legacyProfile.recordingDuration ?? 0;
  const rscPayloads = legacyProfile.rscPayloads;
  const rscAnalysis = legacyProfile.rscAnalysis;

  // Try to extract React version from commits
  const reactVersion = commits[0]?.reactVersion ?? 'unknown';

  // Calculate export size estimate
  const exportSizeEstimate = JSON.stringify({ commits }).length * 2;

  return {
    version: '1.0',
    metadata: {
      profilerVersion: '1.0.0',
      reactVersion,
      exportedAt: new Date().toISOString(),
      format: 'react-perf-profiler-v1',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
      exportSize: exportSizeEstimate,
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
 * Migrate v1.0 to v1.1 (minor enhancement)
 * Adds new optional fields while maintaining backward compatibility
 */
function migrateV1ToV1_1(
  profile: ExportedProfileV1,
  _fromVersion: string,
  _toVersion: string
): ExportedProfileV1 {
  // v1.1 is backward compatible with v1.0 - just adds optional fields
  // For now, return as-is since we don't have v1.1 specific fields yet
  return {
    ...profile,
    version: '1.0', // Keep as 1.0 since structure is same
    metadata: {
      ...profile.metadata,
      // Add any new v1.1 metadata fields here
    },
  };
}

/**
 * Execute multi-step migration following a migration path
 */
function executeMigrationPath(
  profile: unknown,
  path: string[],
  log: MigrationLogEntry[]
): ExportedProfileV1 {
  let currentProfile = profile as ExportedProfileV1;

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];

    if (!from || !to) continue;

    const migration = getMigration(from, to);

    if (!migration) {
      const error = `No migration available from ${from} to ${to}`;
      log.push(createLogEntry(from, to, 'Migration step failed', false, error));
      throw new MigrationError(error, from, to, log);
    }

    try {
      currentProfile = migration(currentProfile, from, to);
      log.push(createLogEntry(from, to, `Migrated from ${from} to ${to}`, true));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      log.push(createLogEntry(from, to, 'Migration step failed', false, errorMsg));
      throw new MigrationError(
        `Migration from ${from} to ${to} failed: ${errorMsg}`,
        from,
        to,
        log
      );
    }
  }

  return currentProfile;
}

/**
 * Migrate profile from one version to another with full logging
 */
export function migrateProfileWithLogging(
  profile: unknown,
  fromVersion: string | number | undefined,
  toVersion: string = '1.0'
): MigrationResult {
  const log: MigrationLogEntry[] = [];

  // Determine source version string
  const sourceVersion =
    fromVersion === undefined
      ? 'legacy'
      : typeof fromVersion === 'number'
        ? `legacy-${fromVersion}`
        : fromVersion;

  // Check if already at target version
  if (sourceVersion === toVersion) {
    log.push(createLogEntry(sourceVersion, toVersion, 'Already at target version', true));
    return {
      profile: profile as ExportedProfileV1,
      migrated: false,
      log,
      fromVersion: sourceVersion,
      toVersion,
    };
  }

  // Try to find migration path first (before integrity check)
  const path = getMigrationPath(sourceVersion, toVersion);
  
  // Check if migration is possible
  if (!path && !sourceVersion.startsWith('legacy') && sourceVersion !== 'legacy') {
    const error = `No migration available from ${sourceVersion} to ${toVersion}`;
    log.push(createLogEntry(sourceVersion, toVersion, error, false));
    throw new MigrationError(error, sourceVersion, toVersion, log);
  }

  // Check for corrupted profile
  const integrity = validateProfileIntegrity(profile);
  if (!integrity.valid) {
    const error = `Profile integrity check failed: ${integrity.errors.join(', ')}`;
    log.push(createLogEntry(sourceVersion, toVersion, 'Integrity check failed', false, error));
    throw new CorruptedProfileError(error, { errors: integrity.errors });
  }

  log.push(createLogEntry(sourceVersion, toVersion, 'Starting migration', true));

  if (path) {
    const migratedProfile = executeMigrationPath(profile, path, log);
    return {
      profile: migratedProfile,
      migrated: true,
      log,
      fromVersion: sourceVersion,
      toVersion,
    };
  }

  // Handle legacy formats with the generic legacy migration
  if (sourceVersion.startsWith('legacy') || sourceVersion === 'legacy') {
    try {
      const migratedProfile = migrateLegacyToV1(
        profile as ExportedProfileLegacy,
        sourceVersion,
        toVersion
      );
      log.push(createLogEntry(sourceVersion, toVersion, 'Legacy migration successful', true));
      return {
        profile: migratedProfile,
        migrated: true,
        log,
        fromVersion: sourceVersion,
        toVersion,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      log.push(createLogEntry(sourceVersion, toVersion, 'Legacy migration failed', false, errorMsg));
      throw new MigrationError(
        `Failed to migrate legacy profile: ${errorMsg}`,
        sourceVersion,
        toVersion,
        log
      );
    }
  }

  // No migration available
  const error = `No migration available from ${sourceVersion} to ${toVersion}`;
  log.push(createLogEntry(sourceVersion, toVersion, error, false));
  throw new MigrationError(error, sourceVersion, toVersion, log);
}

/**
 * Migrate profile from one version to another (legacy API for backward compatibility)
 */
export function migrateProfile(
  profile: unknown,
  fromVersion: string | number | undefined,
  toVersion: string = '1.0'
): ExportedProfileV1 {
  const result = migrateProfileWithLogging(profile, fromVersion, toVersion);
  return result.profile;
}

/**
 * Auto-migrate profile to current version with logging
 */
export function autoMigrateProfileWithLogging(profile: unknown): MigrationResult {
  migrationStats.totalMigrations++;

  try {
    if (typeof profile !== 'object' || profile === null) {
      throw new MigrationError('Invalid profile: expected object', 'unknown', '1.0');
    }

    const p = profile as Record<string, unknown>;

    // Detect version
    let fromVersion: string | number | undefined;

    if (p['version'] === '1.0') {
      // Already v1, return as-is
      migrationStats.successfulMigrations++;
      return {
        profile: profile as ExportedProfileV1,
        migrated: false,
        log: [createLogEntry('1.0', '1.0', 'Already at current version', true)],
        fromVersion: '1.0',
        toVersion: '1.0',
      };
    } else if (p['version'] === '2.0') {
      // v2 detected - for now, treat as compatible with v1
      // In the future, this will migrate v2 -> current
      migrationStats.successfulMigrations++;
      return {
        profile: profile as ExportedProfileV1,
        migrated: false,
        log: [createLogEntry('2.0', '1.0', 'v2.0 detected, treating as compatible', true)],
        fromVersion: '2.0',
        toVersion: '1.0',
      };
    } else if (typeof p['version'] === 'number') {
      fromVersion = p['version'];
    } else if (p['version'] === undefined) {
      fromVersion = undefined;
    } else {
      fromVersion = String(p['version']);
    }

    const result = migrateProfileWithLogging(profile, fromVersion, '1.0');
    migrationStats.successfulMigrations++;
    migrationStats.lastMigration = result.log;
    return result;
  } catch (error) {
    migrationStats.failedMigrations++;
    throw error;
  }
}

/**
 * Auto-migrate profile to current version (legacy API for backward compatibility)
 */
export function autoMigrateProfile(profile: unknown): ExportedProfileV1 {
  const result = autoMigrateProfileWithLogging(profile);
  return result.profile;
}

/**
 * Validate that migrated profile is complete
 */
export function validateMigratedProfile(profile: ExportedProfileV1 | null | undefined): boolean {
  if (!profile) return false;
  
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
 * Get migration statistics
 */
export function getMigrationStats(): typeof migrationStats {
  return { ...migrationStats };
}

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
 * Reset migration statistics (for testing)
 */
export function resetMigrationStats(): void {
  migrationStats.totalMigrations = 0;
  migrationStats.successfulMigrations = 0;
  migrationStats.failedMigrations = 0;
  migrationStats.lastMigration = null;
}

// Register migrations
registerMigration('legacy', '1.0', migrateLegacyToV1);
registerMigration('legacy-0', '1.0', migrateLegacyToV1);
registerMigration('legacy-1', '1.0', migrateLegacyToV1);

// Register future migrations (placeholders)
registerMigration('1.0', '1.1', migrateV1ToV1_1 as MigrationFunction);
// registerMigration('1.1', '2.0', migrateV1ToV2);
