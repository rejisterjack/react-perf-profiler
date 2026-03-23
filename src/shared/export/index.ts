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
 * Create a 320×180 JPEG thumbnail of the current profiler visualization.
 *
 * Resolution strategy (first match wins):
 *  1. `targetElement` supplied by the caller.
 *  2. A `<canvas>` or `<svg>` inside `[data-view-container]` or `<main>`.
 *  3. The first `<canvas>` or `<svg>` anywhere on the page.
 *  4. A data-driven placeholder drawn from `profilingData` (score + bar chart).
 *
 * Canvas elements are drawn directly with `ctx.drawImage`.
 * SVG elements are serialized, turned into a Blob URL, and drawn via `Image`.
 * Returns a base64 JPEG data URL, or `undefined` if anything throws.
 */
export async function createThumbnail(
  targetElement?: Element,
  profilingData?: { commitCount: number; avgDuration: number; score: number }
): Promise<string | undefined> {
  const THUMB_W = 320;
  const THUMB_H = 180;
  const JPEG_QUALITY = 0.8;

  try {
    if (typeof document === 'undefined') return undefined;

    // --- 1. Resolve the source element ---
    let source: Element | null = targetElement ?? null;

    if (!source) {
      const containers = [
        document.querySelector('[data-view-container]'),
        document.querySelector('main'),
      ];
      for (const container of containers) {
        if (!container) continue;
        source = container.querySelector('canvas') ?? container.querySelector('svg');
        if (source) break;
      }
    }

    if (!source) {
      source = document.querySelector('canvas') ?? document.querySelector('svg');
    }

    // Helper: build the output thumbnail canvas
    const makeThumb = (): HTMLCanvasElement => {
      const thumb = document.createElement('canvas');
      thumb.width = THUMB_W;
      thumb.height = THUMB_H;
      return thumb;
    };

    // --- 2. <canvas> path ---
    if (source instanceof HTMLCanvasElement) {
      const thumb = makeThumb();
      const ctx = thumb.getContext('2d');
      if (!ctx) return undefined;
      ctx.drawImage(source, 0, 0, THUMB_W, THUMB_H);
      return thumb.toDataURL('image/jpeg', JPEG_QUALITY);
    }

    // --- 3. <svg> path ---
    if (source instanceof SVGElement) {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(source);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);

      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const thumb = makeThumb();
            const ctx = thumb.getContext('2d');
            if (!ctx) { reject(new Error('no 2d context')); return; }
            ctx.drawImage(img, 0, 0, THUMB_W, THUMB_H);
            resolve(thumb.toDataURL('image/jpeg', JPEG_QUALITY));
          };
          img.onerror = () => reject(new Error('svg image load failed'));
          img.src = blobUrl;
        });
        return dataUrl;
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    }

    // --- 4. Data-driven placeholder ---
    const thumb = makeThumb();
    const ctx = thumb.getContext('2d');
    if (!ctx) return undefined;

    // Dark background
    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, THUMB_W, THUMB_H);

    if (profilingData) {
      const { commitCount, avgDuration, score } = profilingData;

      // Simple bar-chart silhouette
      const BAR_COUNT = Math.min(commitCount, 12);
      const BAR_AREA_W = THUMB_W * 0.7;
      const BAR_AREA_H = THUMB_H * 0.45;
      const BAR_AREA_X = THUMB_W * 0.08;
      const BAR_AREA_Y = THUMB_H * 0.42;
      const BAR_GAP = BAR_AREA_W / (BAR_COUNT * 2);
      const BAR_W = BAR_GAP;

      const MAX_DURATION = avgDuration * 2 || 16;

      ctx.fillStyle = '#6c6f93';
      for (let i = 0; i < BAR_COUNT; i++) {
        // Produce visually varied heights from the available data
        const ratio = Math.abs(Math.sin((i + 1) * avgDuration * 0.3)) * 0.6 + 0.1;
        const barH = Math.min((avgDuration / MAX_DURATION) * BAR_AREA_H * ratio + BAR_AREA_H * 0.15, BAR_AREA_H);
        const x = BAR_AREA_X + i * BAR_GAP * 2;
        const y = BAR_AREA_Y + BAR_AREA_H - barH;
        ctx.fillRect(x, y, BAR_W, barH);
      }

      // Baseline
      ctx.strokeStyle = '#45475a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(BAR_AREA_X - 2, BAR_AREA_Y + BAR_AREA_H + 1);
      ctx.lineTo(BAR_AREA_X + BAR_AREA_W, BAR_AREA_Y + BAR_AREA_H + 1);
      ctx.stroke();

      // Score — large, centered in the right quarter
      const scoreColor =
        score >= 80 ? '#a6e3a1' :
        score >= 50 ? '#f9e2af' :
                      '#f38ba8';

      ctx.fillStyle = scoreColor;
      ctx.font = `bold ${THUMB_H * 0.28}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.round(score)), THUMB_W * 0.84, THUMB_H * 0.38);

      ctx.fillStyle = '#cdd6f4';
      ctx.font = `${THUMB_H * 0.09}px sans-serif`;
      ctx.fillText('score', THUMB_W * 0.84, THUMB_H * 0.58);

      // Commit count label
      ctx.fillStyle = '#6c7086';
      ctx.font = `${THUMB_H * 0.08}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${commitCount} commits`, BAR_AREA_X, THUMB_H * 0.06);
    } else {
      // Minimal placeholder when no data is available
      ctx.fillStyle = '#45475a';
      ctx.font = `${THUMB_H * 0.1}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No preview available', THUMB_W / 2, THUMB_H / 2);
    }

    return thumb.toDataURL('image/jpeg', JPEG_QUALITY);
  } catch {
    return undefined;
  }
}
