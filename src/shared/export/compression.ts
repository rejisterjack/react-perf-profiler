/**
 * Compression utilities for profile exports
 * Provides gzip/deflate compression for large exports
 * @module shared/export/compression
 */

/**
 * Compression result
 */
export interface CompressionResult {
  /** Compressed data as base64 string */
  data: string;
  /** Original size in bytes */
  originalSize: number;
  /** Compressed size in bytes */
  compressedSize: number;
  /** Compression ratio */
  ratio: number;
  /** Algorithm used */
  algorithm: 'gzip' | 'deflate';
}

/**
 * Decompression result
 */
export interface DecompressionResult {
  /** Decompressed data string */
  data: string;
  /** Whether decompression was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Compressed export wrapper
 * This wrapper identifies compressed exports
 */
export interface CompressedExport {
  /** Identifies this as a compressed export */
  __compressed: true;
  /** Compression algorithm used */
  algorithm: 'gzip' | 'deflate';
  /** Original export format version */
  version: string;
  /** Compressed data (base64 encoded) */
  data: string;
  /** Original size in bytes */
  originalSize: number;
  /** Compressed size in bytes */
  compressedSize: number;
  /** Checksum for integrity verification */
  checksum?: string;
}

/**
 * Check if data is a compressed export
 */
export function isCompressedExport(data: unknown): data is CompressedExport {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return d['__compressed'] === true && typeof d['data'] === 'string' && typeof d['algorithm'] === 'string';
}

/**
 * Calculate simple checksum for integrity verification
 */
function calculateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Compress data using gzip via the CompressionStream API
 */
export async function compressData(
  data: string,
  algorithm: 'gzip' | 'deflate' = 'gzip'
): Promise<CompressionResult> {
  const originalSize = new Blob([data]).size;

  try {
    // Check if CompressionStream is available
    if (typeof CompressionStream === 'undefined') {
      throw new Error('CompressionStream API not available');
    }

    const encoder = new TextEncoder();
    const compressed = await new Response(
      new Blob([encoder.encode(data)]).stream().pipeThrough(new CompressionStream(algorithm))
    ).arrayBuffer();

    // Convert to base64
    const base64 = btoa(String.fromCharCode(...new Uint8Array(compressed)));
    const compressedSize = base64.length;

    return {
      data: base64,
      originalSize,
      compressedSize,
      ratio: compressedSize / originalSize,
      algorithm,
    };
  } catch (error) {
    console.warn('Compression failed, returning uncompressed:', error);
    // Fallback: return as-is with compression disabled
    return {
      data,
      originalSize,
      compressedSize: originalSize,
      ratio: 1,
      algorithm,
    };
  }
}

/**
 * Decompress data using DecompressionStream API
 */
export async function decompressData(compressed: CompressedExport): Promise<DecompressionResult> {
  try {
    // Check if DecompressionStream is available
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('DecompressionStream API not available');
    }

    // Decode base64
    const binaryString = atob(compressed.data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decompress
    const decompressed = await new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream(compressed.algorithm))
    ).arrayBuffer();

    const decoder = new TextDecoder();
    const data = decoder.decode(decompressed);

    // Verify checksum if present
    if (compressed.checksum && calculateChecksum(data) !== compressed.checksum) {
      return {
        data: '',
        success: false,
        error: 'Checksum verification failed - data may be corrupted',
      };
    }

    return { data, success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Decompression failed';
    return { data: '', success: false, error: errorMsg };
  }
}

/**
 * Compress an export profile if it exceeds threshold
 */
export async function compressExportIfNeeded(
  profile: string,
  threshold: number = 1024 * 1024, // 1MB default
  version: string = '1.0'
): Promise<CompressedExport | object> {
  const size = new Blob([profile]).size;

  // Only compress if over threshold
  if (size < threshold) {
    return JSON.parse(profile);
  }

  const compressed = await compressData(profile, 'gzip');

  // If compression didn't help much, return original
  if (compressed.ratio > 0.9) {
    return JSON.parse(profile);
  }

  return {
    __compressed: true,
    algorithm: compressed.algorithm,
    version,
    data: compressed.data,
    originalSize: compressed.originalSize,
    compressedSize: compressed.compressedSize,
    checksum: calculateChecksum(profile),
  };
}

/**
 * Decompress an export (handles both compressed and uncompressed)
 */
export async function decompressExport(data: unknown): Promise<DecompressionResult> {
  if (isCompressedExport(data)) {
    return decompressData(data);
  }

  // Not compressed, stringify if object
  if (typeof data === 'object' && data !== null) {
    return { data: JSON.stringify(data), success: true };
  }

  // Already a string
  if (typeof data === 'string') {
    return { data, success: true };
  }

  return { data: '', success: false, error: 'Invalid export format' };
}

/**
 * Get compression info for UI display
 */
export function getCompressionInfo(result: CompressionResult): {
  savings: number;
  savingsPercent: string;
  description: string;
} {
  const savings = result.originalSize - result.compressedSize;
  const savingsPercent = ((savings / result.originalSize) * 100).toFixed(1);

  return {
    savings,
    savingsPercent,
    description: `${savingsPercent}% smaller (${formatBytes(savings)} saved)`,
  };
}

/**
 * Format bytes for display
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

/**
 * Estimate if compression would be beneficial
 */
export function shouldCompress(data: string, threshold: number = 1024 * 1024): boolean {
  const size = new Blob([data]).size;
  return size >= threshold;
}

/**
 * Get compression stats for an export
 */
export function getCompressionStats(
  original: string,
  compressed?: CompressionResult
): {
  originalSize: string;
  compressedSize?: string;
  compressionRatio?: string;
  spaceSaved?: string;
} {
  const originalSize = formatBytes(new Blob([original]).size);

  if (!compressed) {
    return { originalSize };
  }

  return {
    originalSize,
    compressedSize: formatBytes(compressed.compressedSize),
    compressionRatio: `${(compressed.ratio * 100).toFixed(1)}%`,
    spaceSaved: formatBytes(compressed.originalSize - compressed.compressedSize),
  };
}
