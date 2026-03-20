/**
 * Unit tests for export types and validation
 * @module tests/unit/shared/exportTypes
 */

import { describe, it, expect } from 'vitest';
import {
  CURRENT_EXPORT_VERSION,
  SUPPORTED_EXPORT_VERSIONS,
  isVersionSupported,
  getVersionCompatibility,
  validateImportData,
  createExportProfile,
  isExportedProfileV1,
  isExportedProfileLegacy,
  type ExportedProfileV1,
  type ExportedProfileLegacy,
} from '@/shared/types/export';
import type { CommitData } from '@/shared/types';

describe('export types', () => {
  describe('CURRENT_EXPORT_VERSION', () => {
    it('should be "1.0"', () => {
      expect(CURRENT_EXPORT_VERSION).toBe('1.0');
    });
  });

  describe('SUPPORTED_EXPORT_VERSIONS', () => {
    it('should include "1.0"', () => {
      expect(SUPPORTED_EXPORT_VERSIONS).toContain('1.0');
    });
  });

  describe('isVersionSupported', () => {
    it('should return true for supported versions', () => {
      expect(isVersionSupported('1.0')).toBe(true);
    });

    it('should return false for unsupported versions', () => {
      expect(isVersionSupported('2.0')).toBe(false);
      expect(isVersionSupported('0.5')).toBe(false);
      expect(isVersionSupported('unknown')).toBe(false);
    });
  });

  describe('getVersionCompatibility', () => {
    it('should return supported status for v1.0', () => {
      const result = getVersionCompatibility('1.0');
      expect(result.canImport).toBe(true);
      expect(result.needsMigration).toBe(false);
      expect(result.version).toBe('1.0');
    });

    it('should indicate migration needed for undefined version', () => {
      const result = getVersionCompatibility(undefined);
      expect(result.canImport).toBe(true);
      expect(result.needsMigration).toBe(true);
      expect(result.migrateTo).toBe('1.0');
      expect(result.warning).toBeDefined();
    });

    it('should indicate migration needed for legacy number versions', () => {
      const result = getVersionCompatibility(1);
      expect(result.canImport).toBe(true);
      expect(result.needsMigration).toBe(true);
      expect(result.version).toBe('legacy-1');
    });

    it('should return unsupported for unknown versions', () => {
      const result = getVersionCompatibility('2.0');
      expect(result.canImport).toBe(false);
      expect(result.needsMigration).toBe(false);
      expect(result.warning).toContain('Unsupported');
    });
  });

  describe('isExportedProfileV1', () => {
    it('should return true for valid v1 profile', () => {
      const profile: ExportedProfileV1 = {
        version: '1.0',
        metadata: {
          profilerVersion: '1.0.0',
          reactVersion: '18.2.0',
          exportedAt: new Date().toISOString(),
          format: 'react-perf-profiler-v1',
        },
        data: {
          commits: [],
        },
        recordingDuration: 0,
      };
      expect(isExportedProfileV1(profile)).toBe(true);
    });

    it('should return false for legacy profile', () => {
      const profile: ExportedProfileLegacy = {
        version: 1,
        commits: [],
        recordingDuration: 0,
      };
      expect(isExportedProfileV1(profile)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isExportedProfileV1(null)).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isExportedProfileV1('string')).toBe(false);
      expect(isExportedProfileV1(123)).toBe(false);
    });
  });

  describe('isExportedProfileLegacy', () => {
    it('should return true for legacy profile with number version', () => {
      const profile: ExportedProfileLegacy = {
        version: 1,
        commits: [],
        recordingDuration: 0,
      };
      expect(isExportedProfileLegacy(profile)).toBe(true);
    });

    it('should return true for versionless profile', () => {
      const profile = {
        commits: [],
        recordingDuration: 0,
      };
      expect(isExportedProfileLegacy(profile)).toBe(true);
    });

    it('should return false for v1 profile', () => {
      const profile: ExportedProfileV1 = {
        version: '1.0',
        metadata: {
          profilerVersion: '1.0.0',
          reactVersion: '18.2.0',
          exportedAt: new Date().toISOString(),
          format: 'react-perf-profiler-v1',
        },
        data: {
          commits: [],
        },
        recordingDuration: 0,
      };
      expect(isExportedProfileLegacy(profile)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isExportedProfileLegacy(null)).toBe(false);
    });
  });

  describe('validateImportData', () => {
    it('should validate valid v1 profile', () => {
      const profile: ExportedProfileV1 = {
        version: '1.0',
        metadata: {
          profilerVersion: '1.0.0',
          reactVersion: '18.2.0',
          exportedAt: new Date().toISOString(),
          format: 'react-perf-profiler-v1',
        },
        data: {
          commits: [{
            id: 'commit-1',
            timestamp: Date.now(),
            duration: 10,
            nodes: [],
            priorityLevel: 3,
          }],
        },
        recordingDuration: 1000,
      };

      const result = validateImportData(profile);

      expect(result.isValid).toBe(true);
      expect(result.isSupported).toBe(true);
      expect(result.version).toBe('1.0');
      expect(result.preview?.commitCount).toBe(1);
      expect(result.preview?.profilerVersion).toBe('1.0.0');
    });

    it('should validate legacy profile with migration flag', () => {
      const profile = {
        version: 1,
        commits: [{ id: 'test', timestamp: Date.now(), duration: 10, nodes: [] }],
        recordingDuration: 1000,
      };

      const result = validateImportData(profile);

      expect(result.isValid).toBe(true);
      expect(result.isSupported).toBe(false);
      expect(result.migrationAvailable).toBe(true);
      expect(result.migrationTarget).toBe('1.0');
      expect(result.warning).toContain('Legacy format');
    });

    it('should reject invalid data', () => {
      const result = validateImportData(null);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid file format');
    });

    it('should reject data without commits', () => {
      const profile = {
        version: '1.0',
        metadata: {
          profilerVersion: '1.0.0',
          exportedAt: new Date().toISOString(),
          format: 'react-perf-profiler-v1',
        },
        data: {},
        recordingDuration: 0,
      };

      const result = validateImportData(profile);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('missing commits array');
    });

    it('should detect analysis results in preview', () => {
      const profile: ExportedProfileV1 = {
        version: '1.0',
        metadata: {
          profilerVersion: '1.0.0',
          reactVersion: '18.2.0',
          exportedAt: new Date().toISOString(),
          format: 'react-perf-profiler-v1',
        },
        data: {
          commits: [],
          analysisResults: {
            timestamp: Date.now(),
            totalCommits: 0,
            wastedRenderReports: [],
            memoReports: [],
            performanceScore: 0,
            topOpportunities: [],
          },
        },
        recordingDuration: 0,
      };

      const result = validateImportData(profile);

      expect(result.preview?.hasAnalysis).toBe(true);
    });

    it('should detect RSC data in preview', () => {
      const profile: ExportedProfileV1 = {
        version: '1.0',
        metadata: {
          profilerVersion: '1.0.0',
          reactVersion: '18.2.0',
          exportedAt: new Date().toISOString(),
          format: 'react-perf-profiler-v1',
        },
        data: {
          commits: [],
          rscPayloads: [{
            id: 'rsc-1',
            timestamp: Date.now(),
            totalSize: 1000,
            serverComponentCount: 5,
            clientComponentCount: 2,
            boundaries: [],
            chunks: [],
          }],
        },
        recordingDuration: 0,
      };

      const result = validateImportData(profile);

      expect(result.preview?.hasRSCData).toBe(true);
    });
  });

  describe('createExportProfile', () => {
    it('should create valid v1 export profile', () => {
      const commits: CommitData[] = [{
        id: 'commit-1',
        timestamp: Date.now(),
        duration: 10,
        nodes: [],
        priorityLevel: 3,
      }];
      const recordingDuration = 5000;

      const profile = createExportProfile(commits, recordingDuration, {
        reactVersion: '18.2.0',
      });

      expect(profile.version).toBe('1.0');
      expect(profile.metadata.profilerVersion).toBe('1.0.0');
      expect(profile.metadata.reactVersion).toBe('18.2.0');
      expect(profile.metadata.format).toBe('react-perf-profiler-v1');
      expect(profile.metadata.exportedAt).toBeDefined();
      expect(profile.data.commits).toBe(commits);
      expect(profile.recordingDuration).toBe(recordingDuration);
    });

    it('should include optional data when provided', () => {
      const analysisResults = {
        timestamp: Date.now(),
        totalCommits: 1,
        wastedRenderReports: [],
        memoReports: [],
        performanceScore: 90,
        topOpportunities: [],
      };
      const rscPayloads = [{
        id: 'rsc-1',
        timestamp: Date.now(),
        totalSize: 1000,
        serverComponentCount: 5,
        clientComponentCount: 2,
        boundaries: [],
        chunks: [],
      }];

      const profile = createExportProfile([], 0, {
        analysisResults,
        rscPayloads,
        sourceUrl: 'http://localhost:3000',
      });

      expect(profile.data.analysisResults).toBe(analysisResults);
      expect(profile.data.rscPayloads).toBe(rscPayloads);
      expect(profile.metadata.sourceUrl).toBe('http://localhost:3000');
    });

    it('should default to "unknown" for react version', () => {
      const profile = createExportProfile([], 0);
      expect(profile.metadata.reactVersion).toBe('unknown');
    });

    it('should generate ISO timestamp for exportedAt', () => {
      const before = new Date().toISOString();
      const profile = createExportProfile([], 0);
      const after = new Date().toISOString();

      expect(profile.metadata.exportedAt >= before).toBe(true);
      expect(profile.metadata.exportedAt <= after).toBe(true);
    });
  });
});
