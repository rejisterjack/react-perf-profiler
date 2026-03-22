/**
 * Export utilities for React Perf Profiler
 * @module shared/export
 */

export * from './migrations';
export * from './compression';
export * from './cloudSync';

import type { ExportedProfileV1, ExportOptions, ExportFormat } from '@/shared/types/export';
import {
  createCSVExport,
  createHTMLExport,
} from '@/shared/types/export';
import { compressExportIfNeeded } from './compression';

/**
 * Export profile to file with all enhancements
 */
export async function exportProfileToFile(
  profile: ExportedProfileV1,
  format: ExportFormat = 'json',
  options: ExportOptions = {}
): Promise<{ data: string | Blob; filename: string; mimeType: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseFilename = options.fileName || `react-perf-profile-${timestamp}`;

  switch (format) {
    case 'csv': {
      const csv = createCSVExport(profile.data.commits);
      return {
        data: new Blob([csv], { type: 'text/csv' }),
        filename: `${baseFilename}.csv`,
        mimeType: 'text/csv',
      };
    }

    case 'html': {
      const html = createHTMLExport(
        profile.data.commits,
        profile.data.analysisResults,
        {
          title: baseFilename,
          reactVersion: profile.metadata.reactVersion,
        }
      );
      return {
        data: new Blob([html], { type: 'text/html' }),
        filename: `${baseFilename}.html`,
        mimeType: 'text/html',
      };
    }

    case 'json':
    default: {
      const jsonString = JSON.stringify(profile, null, 2);

      // Check if compression is enabled and beneficial
      const threshold = options.compressionThreshold || 1024 * 1024; // 1MB default
      const shouldCompress = options.compress !== false && jsonString.length > threshold;

      if (shouldCompress) {
        const compressed = await compressExportIfNeeded(jsonString, threshold, profile.version);
        const finalJson = JSON.stringify(compressed, null, 2);

        return {
          data: new Blob([finalJson], { type: 'application/json' }),
          filename: `${baseFilename}.json`,
          mimeType: 'application/json',
        };
      }

      return {
        data: new Blob([jsonString], { type: 'application/json' }),
        filename: `${baseFilename}.json`,
        mimeType: 'application/json',
      };
    }
  }
}

/**
 * Download export as file
 */
export function downloadExport(
  data: Blob | string,
  filename: string,
  mimeType: string = 'application/json'
): void {
  if (typeof window === 'undefined') return;

  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 0);
}

/**
 * Import profile from file content with decompression support
 */
export async function importProfileFromContent(
  content: string
): Promise<{
  success: boolean;
  profile?: ExportedProfileV1;
  error?: string;
  compressed?: boolean;
}> {
  try {
    const data = JSON.parse(content);

    // Check if compressed
    if (data.__compressed) {
      const { decompressExport } = await import('./compression');
      const result = await decompressExport(data);

      if (!result.success) {
        return { success: false, error: result.error, compressed: true };
      }

      return {
        success: true,
        profile: JSON.parse(result.data),
        compressed: true,
      };
    }

    return {
      success: true,
      profile: data,
      compressed: false,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse profile',
      compressed: false,
    };
  }
}

/**
 * Create a thumbnail from current view
 * This is a placeholder - actual implementation would capture canvas/screenshot
 */
export async function createThumbnail(): Promise<string | undefined> {
  // Placeholder for thumbnail generation
  // In a real implementation, this would:
  // 1. Find the canvas or main view element
  // 2. Use html2canvas or similar to capture screenshot
  // 3. Resize and compress to thumbnail size
  // 4. Return as base64 data URL

  return undefined;
}
