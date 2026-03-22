import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isCompressedExport,
  compressData,
  decompressData,
  compressExportIfNeeded,
  decompressExport,
  getCompressionInfo,
  shouldCompress,
  getCompressionStats,
  type CompressedExport,
} from '@/shared/export/compression';

// Mock CompressionStream and DecompressionStream
global.CompressionStream = vi.fn().mockImplementation((algorithm: string) => ({
  readable: new ReadableStream(),
  writable: new WritableStream(),
}));

global.DecompressionStream = vi.fn().mockImplementation((algorithm: string) => ({
  readable: new ReadableStream(),
  writable: new WritableStream(),
}));

// Mock Response for arrayBuffer
global.Response = vi.fn().mockImplementation((body: BodyInit | null) => ({
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
}));

describe('isCompressedExport', () => {
  it('should return true for valid compressed export', () => {
    const data = {
      __compressed: true,
      algorithm: 'gzip',
      version: '1.0',
      data: 'base64encodeddata',
      originalSize: 1000,
      compressedSize: 500,
    };

    expect(isCompressedExport(data)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isCompressedExport(null)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isCompressedExport('string')).toBe(false);
  });

  it('should return false when __compressed is not true', () => {
    const data = { __compressed: false, data: 'test' };
    expect(isCompressedExport(data)).toBe(false);
  });

  it('should return false when data is not a string', () => {
    const data = { __compressed: true, data: 123 };
    expect(isCompressedExport(data)).toBe(false);
  });

  it('should return false when algorithm is missing', () => {
    const data = { __compressed: true, data: 'test' };
    expect(isCompressedExport(data)).toBe(false);
  });
});

describe('compressData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return compression result', async () => {
    // Mock successful compression
    const mockStream = new ReadableStream();
    const mockWritable = new WritableStream();
    
    (global.CompressionStream as any).mockImplementation(() => ({
      readable: mockStream,
      writable: mockWritable,
    }));

    const result = await compressData('test data', 'gzip');

    expect(result.algorithm).toBe('gzip');
    expect(typeof result.data).toBe('string');
    expect(result.originalSize).toBeGreaterThan(0);
  });

  it('should handle compression failure', async () => {
    // Remove CompressionStream to simulate failure
    const originalCompressionStream = global.CompressionStream;
    global.CompressionStream = undefined as any;

    const result = await compressData('test data');

    expect(result.ratio).toBe(1);
    expect(result.data).toBe('test data');

    global.CompressionStream = originalCompressionStream;
  });
});

describe('decompressData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle missing DecompressionStream', async () => {
    const originalDecompressionStream = global.DecompressionStream;
    global.DecompressionStream = undefined as any;

    const compressed: CompressedExport = {
      __compressed: true,
      algorithm: 'gzip',
      version: '1.0',
      data: btoa('test data'),
      originalSize: 100,
      compressedSize: 50,
    };

    const result = await decompressData(compressed);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not available');

    global.DecompressionStream = originalDecompressionStream;
  });

  it('should handle decompression failure', async () => {
    const compressed: CompressedExport = {
      __compressed: true,
      algorithm: 'gzip',
      version: '1.0',
      data: 'invalid-base64!!!',
      originalSize: 100,
      compressedSize: 50,
    };

    const result = await decompressData(compressed);

    expect(result.success).toBe(false);
  });
});

describe('compressExportIfNeeded', () => {
  it('should return original data when under threshold', async () => {
    const profile = JSON.stringify({ small: 'data' });
    const threshold = 1024 * 1024; // 1MB

    const result = await compressExportIfNeeded(profile, threshold);

    expect(isCompressedExport(result)).toBe(false);
  });
});

describe('decompressExport', () => {
  it('should return object data as-is', async () => {
    const data = { test: true };

    const result = await decompressExport(data);

    expect(result.success).toBe(true);
    expect(JSON.parse(result.data)).toEqual(data);
  });

  it('should return string data as-is', async () => {
    const data = '{"test": true}';

    const result = await decompressExport(data);

    expect(result.success).toBe(true);
    expect(result.data).toBe(data);
  });

  it('should return error for invalid format', async () => {
    const result = await decompressExport(12345);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid export format');
  });
});

describe('getCompressionInfo', () => {
  it('should calculate savings correctly', () => {
    const result = {
      data: 'compressed',
      originalSize: 1000,
      compressedSize: 600,
      ratio: 0.6,
      algorithm: 'gzip' as const,
    };

    const info = getCompressionInfo(result);

    expect(info.savings).toBe(400);
    expect(info.savingsPercent).toBe('40.0');
    expect(info.description).toContain('40.0%');
    expect(info.description).toContain('400 B saved');
  });

  it('should handle zero savings', () => {
    const result = {
      data: 'same',
      originalSize: 100,
      compressedSize: 100,
      ratio: 1,
      algorithm: 'gzip' as const,
    };

    const info = getCompressionInfo(result);

    expect(info.savings).toBe(0);
    expect(info.savingsPercent).toBe('0.0');
  });
});

describe('shouldCompress', () => {
  it('should return true for large data', () => {
    const largeData = 'x'.repeat(2 * 1024 * 1024);
    expect(shouldCompress(largeData)).toBe(true);
  });

  it('should return false for small data', () => {
    const smallData = 'small data';
    expect(shouldCompress(smallData)).toBe(false);
  });

  it('should use custom threshold', () => {
    const data = 'x'.repeat(500);
    expect(shouldCompress(data, 1000)).toBe(false);
    expect(shouldCompress(data, 100)).toBe(true);
  });
});

describe('getCompressionStats', () => {
  it('should return stats without compressed data', () => {
    const original = 'x'.repeat(1000);

    const stats = getCompressionStats(original);

    expect(stats.originalSize).toBeDefined();
    expect(stats.compressedSize).toBeUndefined();
  });

  it('should return stats with compressed data', () => {
    const original = 'x'.repeat(1000);
    const compressed = {
      data: 'compressed',
      originalSize: 1000,
      compressedSize: 500,
      ratio: 0.5,
      algorithm: 'gzip' as const,
    };

    const stats = getCompressionStats(original, compressed);

    expect(stats.originalSize).toBeDefined();
    expect(stats.compressedSize).toBeDefined();
    expect(stats.compressionRatio).toBeDefined();
    expect(stats.spaceSaved).toBeDefined();
  });
});
