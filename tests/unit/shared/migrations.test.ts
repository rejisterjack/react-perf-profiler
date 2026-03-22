/**
 * Unit tests for export migrations
 * @module tests/unit/shared/migrations
 */

import { describe, it, expect } from 'vitest';
import {
  migrateProfile,
  autoMigrateProfile,
  migrateLegacyToV1,
  validateMigratedProfile,
  registerMigration,
  getMigration,
  isMigrationAvailable,
  getAvailableMigrations,
  getMigrationPath,
  MigrationError,
  type ExportedProfileV1,
  type ExportedProfileLegacy,
} from '@/shared/export/migrations';

describe('export migrations', () => {
  describe('migrateLegacyToV1', () => {
    it('should migrate legacy profile to v1', () => {
      const legacyProfile: ExportedProfileLegacy = {
        version: 1,
        commits: [{
          id: 'commit-1',
          timestamp: Date.now(),
          duration: 10,
          nodes: [],
          priorityLevel: 3,
        }],
        recordingDuration: 5000,
        rscPayloads: [],
        rscAnalysis: null,
      };

      const migrated = migrateLegacyToV1(legacyProfile, 'legacy-1', '1.0');

      expect(migrated.version).toBe('1.0');
      expect(migrated.metadata).toBeDefined();
      expect(migrated.metadata.profilerVersion).toBe('1.0.0');
      expect(migrated.metadata.format).toBe('react-perf-profiler-v1');
      expect(migrated.data.commits).toHaveLength(1);
      expect(migrated.data.commits[0].id).toBe('commit-1');
      expect(migrated.recordingDuration).toBe(5000);
    });

    it('should extract React version from commits', () => {
      const legacyProfile: ExportedProfileLegacy = {
        commits: [{
          id: 'commit-1',
          timestamp: Date.now(),
          duration: 10,
          nodes: [],
          priorityLevel: 3,
          reactVersion: '18.2.0',
        }],
        recordingDuration: 0,
      };

      const migrated = migrateLegacyToV1(legacyProfile, 'legacy', '1.0');

      expect(migrated.metadata.reactVersion).toBe('18.2.0');
    });

    it('should default to "unknown" for React version', () => {
      const legacyProfile: ExportedProfileLegacy = {
        commits: [],
        recordingDuration: 0,
      };

      const migrated = migrateLegacyToV1(legacyProfile, 'legacy', '1.0');

      expect(migrated.metadata.reactVersion).toBe('unknown');
    });

    it('should throw MigrationError for unsupported target version', () => {
      const legacyProfile: ExportedProfileLegacy = {
        commits: [],
        recordingDuration: 0,
      };

      expect(() => {
        migrateLegacyToV1(legacyProfile, 'legacy', '2.0');
      }).toThrow(MigrationError);
    });
  });

  describe('migrateProfile', () => {
    it('should migrate from legacy to v1.0', () => {
      const legacyProfile: ExportedProfileLegacy = {
        version: 1,
        commits: [{ id: 'test', timestamp: Date.now(), duration: 10, nodes: [] }],
        recordingDuration: 1000,
      };

      const migrated = migrateProfile(legacyProfile, 1, '1.0');

      expect(migrated.version).toBe('1.0');
      expect(validateMigratedProfile(migrated)).toBe(true);
    });

    it('should migrate from versionless to v1.0', () => {
      const versionlessProfile = {
        commits: [{ id: 'test', timestamp: Date.now(), duration: 10, nodes: [] }],
        recordingDuration: 1000,
      };

      const migrated = migrateProfile(versionlessProfile, undefined, '1.0');

      expect(migrated.version).toBe('1.0');
    });

    it('should return profile as-is if already at target version', () => {
      const v1Profile: ExportedProfileV1 = {
        version: '1.0',
        metadata: {
          profilerVersion: '1.0.0',
          reactVersion: '18.2.0',
          exportedAt: new Date().toISOString(),
          format: 'react-perf-profiler-v1',
        },
        data: { commits: [] },
        recordingDuration: 0,
      };

      const result = migrateProfile(v1Profile, '1.0', '1.0');

      expect(result).toBe(v1Profile);
    });

    it('should throw CorruptedProfileError for invalid profile when migrating to v2.0', () => {
      // Empty object is not a valid v1 profile - integrity check fails
      expect(() => {
        migrateProfile({}, '1.0', '2.0');
      }).toThrow();
    });

    it('should migrate v1.0 to v2.0 successfully', () => {
      const v1Profile: ExportedProfileV1 = {
        version: '1.0',
        metadata: {
          profilerVersion: '1.0.0',
          reactVersion: '18.2.0',
          exportedAt: new Date().toISOString(),
          format: 'react-perf-profiler-v1',
        },
        data: {
          commits: [
            {
              id: 'commit-1',
              timestamp: Date.now(),
              duration: 16.5,
              priorityLevel: 'Normal',
              nodes: [
                {
                  id: 1,
                  displayName: 'App',
                  actualDuration: 5.2,
                  baseDuration: 8.1,
                  props: {},
                  hasContextChanged: false,
                  parentId: null,
                  children: [2],
                  isMemoized: false,
                },
                {
                  id: 2,
                  displayName: 'Header',
                  actualDuration: 2.1,
                  baseDuration: 3.0,
                  props: {},
                  hasContextChanged: false,
                  parentId: 1,
                  children: [],
                  isMemoized: true,
                },
              ],
            },
          ],
        },
        recordingDuration: 1000,
      };

      const migrated = migrateProfile(v1Profile, '1.0', '2.0');

      expect(migrated.version).toBe('2.0');
      expect(migrated.metadata.format).toBe('react-perf-profiler-v2');
      expect(migrated.data.componentGraph).toBeDefined();
      expect(migrated.data.performanceTimeline).toBeDefined();
      expect(migrated.data.componentGraph?.nodes).toHaveLength(2);
      expect(migrated.data.componentGraph?.edges).toHaveLength(1);
    });

    it('should auto-detect and migrate legacy formats', () => {
      const legacyProfile = {
        version: 1,
        commits: [{ id: 'test', timestamp: Date.now(), duration: 10, nodes: [] }],
        recordingDuration: 1000,
      };

      const migrated = migrateProfile(legacyProfile, 1, '1.0');

      expect(migrated.version).toBe('1.0');
    });
  });

  describe('autoMigrateProfile', () => {
    it('should return v1 profile as-is', () => {
      const v1Profile: ExportedProfileV1 = {
        version: '1.0',
        metadata: {
          profilerVersion: '1.0.0',
          reactVersion: '18.2.0',
          exportedAt: new Date().toISOString(),
          format: 'react-perf-profiler-v1',
        },
        data: { commits: [] },
        recordingDuration: 0,
      };

      const result = autoMigrateProfile(v1Profile);

      expect(result).toBe(v1Profile);
    });

    it('should auto-migrate legacy profile', () => {
      const legacyProfile = {
        version: 1,
        commits: [{ id: 'test', timestamp: Date.now(), duration: 10, nodes: [] }],
        recordingDuration: 1000,
      };

      const result = autoMigrateProfile(legacyProfile);

      expect(result.version).toBe('1.0');
      expect(validateMigratedProfile(result)).toBe(true);
    });

    it('should auto-migrate versionless profile', () => {
      const versionlessProfile = {
        commits: [{ id: 'test', timestamp: Date.now(), duration: 10, nodes: [] }],
        recordingDuration: 1000,
      };

      const result = autoMigrateProfile(versionlessProfile);

      expect(result.version).toBe('1.0');
    });

    it('should throw MigrationError for invalid profile', () => {
      expect(() => {
        autoMigrateProfile(null);
      }).toThrow(MigrationError);

      expect(() => {
        autoMigrateProfile('string');
      }).toThrow(MigrationError);
    });

    it('should auto-detect version from string version field', () => {
      const profile = {
        version: '1.0',
        metadata: {
          profilerVersion: '1.0.0',
          reactVersion: '18.2.0',
          exportedAt: new Date().toISOString(),
          format: 'react-perf-profiler-v1',
        },
        data: { commits: [] },
        recordingDuration: 0,
      };

      const result = autoMigrateProfile(profile);

      expect(result).toBe(profile);
    });
  });

  describe('validateMigratedProfile', () => {
    it('should return true for valid v1 profile', () => {
      const profile: ExportedProfileV1 = {
        version: '1.0',
        metadata: {
          profilerVersion: '1.0.0',
          reactVersion: '18.2.0',
          exportedAt: new Date().toISOString(),
          format: 'react-perf-profiler-v1',
        },
        data: { commits: [] },
        recordingDuration: 0,
      };

      expect(validateMigratedProfile(profile)).toBe(true);
    });

    it('should return false for invalid profile', () => {
      expect(validateMigratedProfile(null as any)).toBe(false);
      expect(validateMigratedProfile({} as any)).toBe(false);
      expect(validateMigratedProfile({ version: '2.0' } as any)).toBe(false);
    });

    it('should return false if metadata is missing required fields', () => {
      const profile = {
        version: '1.0',
        metadata: {},
        data: { commits: [] },
        recordingDuration: 0,
      };

      expect(validateMigratedProfile(profile as any)).toBe(false);
    });
  });

  describe('migration registry', () => {
    it('should register and retrieve migrations', () => {
      const mockMigration = () => ({
        version: '1.0',
        metadata: {
          profilerVersion: '1.0.0',
          reactVersion: '18.2.0',
          exportedAt: new Date().toISOString(),
          format: 'react-perf-profiler-v1',
        },
        data: { commits: [] },
        recordingDuration: 0,
      });

      registerMigration('custom-from', 'custom-to', mockMigration);

      const retrieved = getMigration('custom-from', 'custom-to');
      expect(retrieved).toBe(mockMigration);
    });

    it('should check if migration is available', () => {
      expect(isMigrationAvailable('legacy', '1.0')).toBe(true);
      expect(isMigrationAvailable('unknown', '1.0')).toBe(false);
    });

    it('should return list of available migrations', () => {
      const migrations = getAvailableMigrations();
      
      // Should include at least legacy migrations
      const hasLegacyMigration = migrations.some(
        m => m.from === 'legacy' && m.to === '1.0'
      );
      expect(hasLegacyMigration).toBe(true);
    });
  });

  describe('getMigrationPath', () => {
    it('should return direct path if available', () => {
      const path = getMigrationPath('legacy', '1.0');
      expect(path).toEqual(['legacy', '1.0']);
    });

    it('should return direct path for v1.0 to v2.0 migration', () => {
      const path = getMigrationPath('1.0', '2.0');
      expect(path).toEqual(['1.0', '2.0']);
    });

    it('should return null for truly unavailable paths', () => {
      const path = getMigrationPath('2.0', '3.0');
      expect(path).toBeNull();
    });
  });

  describe('MigrationError', () => {
    it('should create error with correct properties', () => {
      const error = new MigrationError('Test error', '1.0', '2.0');

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('MigrationError');
      expect(error.fromVersion).toBe('1.0');
      expect(error.toVersion).toBe('2.0');
    });
  });

  // ===========================================================================
  // v1.0 → v2.0 migration — deep output validation
  // ===========================================================================

  describe('v1.0 → v2.0 migration output', () => {
    /** Reusable v1 profile with a two-node parent-child tree */
    const makeV1Profile = (overrides?: Partial<ExportedProfileV1['data']>): ExportedProfileV1 => ({
      version: '1.0',
      metadata: {
        profilerVersion: '1.0.0',
        reactVersion: '18.2.0',
        exportedAt: new Date().toISOString(),
        format: 'react-perf-profiler-v1',
      },
      data: {
        commits: [
          {
            id: 'c1',
            timestamp: 1000,
            duration: 10,
            priorityLevel: 'Normal',
            nodes: [
              {
                id: 1,
                displayName: 'App',
                actualDuration: 6,
                baseDuration: 8,
                props: {},
                hasContextChanged: false,
                parentId: null,
                children: [2],
                isMemoized: false,
              },
              {
                id: 2,
                displayName: 'Header',
                actualDuration: 2,
                baseDuration: 3,
                props: {},
                hasContextChanged: false,
                parentId: 1,
                children: [],
                isMemoized: true,
              },
            ],
          },
          {
            id: 'c2',
            timestamp: 2000,
            duration: 8,
            priorityLevel: 'Normal',
            nodes: [
              {
                id: 1,
                displayName: 'App',
                actualDuration: 4,
                baseDuration: 8,
                props: {},
                hasContextChanged: false,
                parentId: null,
                children: [],
                isMemoized: false,
              },
            ],
          },
        ],
        ...overrides,
      },
      recordingDuration: 2000,
    });

    it('produces componentGraph with correct node names', () => {
      const result = migrateProfile(makeV1Profile(), '1.0', '2.0');
      const nodes = result.data.componentGraph?.nodes ?? [];
      const names = nodes.map((n) => n.name);
      expect(names).toContain('App');
      expect(names).toContain('Header');
    });

    it('deduplicates componentGraph nodes across commits', () => {
      const result = migrateProfile(makeV1Profile(), '1.0', '2.0');
      const nodes = result.data.componentGraph?.nodes ?? [];
      // App appears in both commits — should only appear once
      const appCount = nodes.filter((n) => n.name === 'App').length;
      expect(appCount).toBe(1);
    });

    it('produces componentGraph edges representing parent-child relationships', () => {
      const result = migrateProfile(makeV1Profile(), '1.0', '2.0');
      const edges = result.data.componentGraph?.edges ?? [];
      const parentChildEdge = edges.find(
        (e) => e.source === 'App' && e.target === 'Header'
      );
      expect(parentChildEdge).toBeDefined();
      expect(parentChildEdge?.type).toBe('parent-child');
    });

    it('deduplicates edges (same parent-child seen in multiple commits)', () => {
      // Both commits have App → Header relationship
      const profile = makeV1Profile();
      profile.data.commits[1]!.nodes = [
        { id: 1, displayName: 'App', actualDuration: 4, baseDuration: 8, props: {}, hasContextChanged: false, parentId: null, children: [2], isMemoized: false },
        { id: 2, displayName: 'Header', actualDuration: 1, baseDuration: 3, props: {}, hasContextChanged: false, parentId: 1, children: [], isMemoized: true },
      ];
      const result = migrateProfile(profile, '1.0', '2.0');
      const edges = result.data.componentGraph?.edges ?? [];
      const appToHeaderEdges = edges.filter(
        (e) => e.source === 'App' && e.target === 'Header'
      );
      expect(appToHeaderEdges).toHaveLength(1);
    });

    it('performanceTimeline entries are sorted by timestamp', () => {
      const result = migrateProfile(makeV1Profile(), '1.0', '2.0');
      const timeline = result.data.performanceTimeline ?? [];
      expect(timeline.length).toBeGreaterThan(0);
      for (let i = 1; i < timeline.length; i++) {
        expect(timeline[i]!.timestamp).toBeGreaterThanOrEqual(timeline[i - 1]!.timestamp);
      }
    });

    it('performanceTimeline includes commitDuration metric for each commit', () => {
      const result = migrateProfile(makeV1Profile(), '1.0', '2.0');
      const timeline = result.data.performanceTimeline ?? [];
      const durationEntries = timeline.filter((e) => e.metric === 'commitDuration');
      // One per commit
      expect(durationEntries).toHaveLength(2);
    });

    it('performanceTimeline includes renderCount metric', () => {
      const result = migrateProfile(makeV1Profile(), '1.0', '2.0');
      const timeline = result.data.performanceTimeline ?? [];
      const renderCountEntries = timeline.filter((e) => e.metric === 'renderCount');
      expect(renderCountEntries.length).toBeGreaterThan(0);
    });

    it('performanceTimeline includes totalActualDuration metric', () => {
      const result = migrateProfile(makeV1Profile(), '1.0', '2.0');
      const timeline = result.data.performanceTimeline ?? [];
      const durationEntries = timeline.filter((e) => e.metric === 'totalActualDuration');
      expect(durationEntries.length).toBeGreaterThan(0);
    });

    it('preserves original commits in migrated v2 profile', () => {
      const v1 = makeV1Profile();
      const result = migrateProfile(v1, '1.0', '2.0');
      expect(result.data.commits).toEqual(v1.data.commits);
    });

    it('updates version and format fields', () => {
      const result = migrateProfile(makeV1Profile(), '1.0', '2.0');
      expect(result.version).toBe('2.0');
      expect(result.metadata.format).toBe('react-perf-profiler-v2');
    });

    it('handles commits with empty nodes array (no graph entries from that commit)', () => {
      const v1 = makeV1Profile({ commits: [
        { id: 'empty', timestamp: 500, duration: 5, priorityLevel: 'Normal', nodes: [] },
      ]});
      const result = migrateProfile(v1, '1.0', '2.0');
      expect(result.data.componentGraph?.nodes).toHaveLength(0);
      expect(result.data.componentGraph?.edges).toHaveLength(0);
      // Timeline should still have commitDuration entry
      const timeline = result.data.performanceTimeline ?? [];
      expect(timeline.some((e) => e.metric === 'commitDuration')).toBe(true);
    });

    it('throws CorruptedProfileError for structurally invalid input', () => {
      expect(() => migrateProfile({} as ExportedProfileV1, '1.0', '2.0')).toThrow();
    });
  });
});
