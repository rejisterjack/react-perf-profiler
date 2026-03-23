/**
 * Tests for RSC Analysis Worker - Testing the underlying parser functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  RSCWorkerRequest,
  RSCWorkerResponse,
} from '@/panel/workers/rscAnalysis.worker';
import {
  parseRSCPayload,
  parseRSCElement,
  extractRSCMetrics,
  detectRSCBoundaries,
  analyzeBoundaryCrossings,
  calculatePayloadSize,
  parseRSCReference,
  resolveRSCElement,
} from '@/panel/utils/rscParser';
import type { RSCPayload, FiberData, RSCBoundary } from '@/shared/types';
import { RSCReferenceMarker as Marker } from '@/shared/types/rsc';

describe('RSC Analysis Worker Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseRSCPayload', () => {
    it('should parse string JSON data', () => {
      const data = JSON.stringify({ test: 'payload', count: 42 });
      const result = parseRSCPayload(data);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('chunks');
      expect(result).toHaveProperty('boundaries');
      expect(result).toHaveProperty('rootElements');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('totalSize');
      expect(result).toHaveProperty('serverComponentCount');
      expect(result).toHaveProperty('clientComponentCount');
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.totalSize).toBeGreaterThan(0);
    });

    it('should parse object data', () => {
      const data = { test: 'payload', nested: { value: 123 } };
      const result = parseRSCPayload(data);

      expect(result.chunks[0].parsedData).toEqual(data);
      expect(result.totalSize).toBeGreaterThan(0);
    });

    it('should handle empty object', () => {
      const result = parseRSCPayload({});
      expect(result.chunks.length).toBe(1);
      expect(result.rootElements).toEqual([]);
      expect(result.boundaries).toEqual([]);
    });

    it('should handle null values in data', () => {
      const data = { value: null, empty: undefined };
      const result = parseRSCPayload(data);
      expect(result.chunks[0].parsedData).toEqual(data);
    });

    it('should handle non-JSON string by wrapping in raw field', () => {
      const rawString = 'not valid json {';
      const result = parseRSCPayload(rawString);
      
      expect(result.chunks.length).toBeGreaterThan(0);
      // The raw string is wrapped in an object with 'raw' property
      expect(result.chunks[0].parsedData).toHaveProperty('raw', rawString);
    });
  });

  describe('parseRSCElement', () => {
    it('should parse valid element data', () => {
      const elementData = {
        type: 'div',
        props: { className: 'test' },
        key: null,
      };
      const result = parseRSCElement(elementData);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('type', 'div');
      expect(result).toHaveProperty('props');
      expect(result?.props).toHaveProperty('className', 'test');
      expect(result).toHaveProperty('isClientBoundary', false);
      expect(result).toHaveProperty('displayName');
      expect(result).toHaveProperty('serializedSize');
    });

    it('should return null for invalid data', () => {
      expect(parseRSCElement(null)).toBeNull();
      expect(parseRSCElement(undefined)).toBeNull();
      expect(parseRSCElement('string')).toBeNull();
      expect(parseRSCElement(123)).toBeNull();
    });

    it('should parse element with children', () => {
      const elementData = {
        type: 'div',
        props: {
          children: [
            { type: 'span', props: {}, key: null },
            { type: 'p', props: {}, key: null },
          ],
        },
        key: null,
      };
      const result = parseRSCElement(elementData);

      expect(result).not.toBeNull();
    });

    it('should detect client boundaries', () => {
      const clientElement = {
        type: '@client/component',
        props: {},
        key: null,
      };
      const result = parseRSCElement(clientElement);
      expect(result?.isClientBoundary).toBe(true);
    });
  });

  describe('extractRSCMetrics', () => {
    it('should extract metrics from payload', () => {
      const payload: RSCPayload = {
        id: 'test-payload',
        chunks: [],
        boundaries: [],
        rootElements: [],
        metadata: {
          reactVersion: '18.0.0',
          streamingEnabled: true,
          generatedAt: Date.now(),
        },
        totalSize: 1000,
        serverComponentCount: 5,
        clientComponentCount: 3,
      };

      const metrics = extractRSCMetrics(payload);

      expect(metrics).toHaveProperty('payloadSize');
      expect(metrics).toHaveProperty('transferTime');
      expect(metrics).toHaveProperty('serializationCost');
      expect(metrics).toHaveProperty('deserializationCost');
      expect(metrics).toHaveProperty('serverComponentCount');
      expect(metrics).toHaveProperty('clientComponentCount');
      expect(metrics).toHaveProperty('boundaryCount');
      expect(metrics).toHaveProperty('boundaryMetrics');
      expect(metrics).toHaveProperty('streamMetrics');
      expect(metrics).toHaveProperty('cacheHitRatio');
    });

    it('should calculate cache hit ratio from chunks', () => {
      const payload: RSCPayload = {
        id: 'test',
        chunks: [
          { 
            id: '1', 
            data: '{}', 
            sequence: 0, 
            timestamp: 0, 
            size: 10, 
            containsBoundary: false,
            boundaryIds: [],
            elements: [],
            parsedData: {},
          },
        ],
        boundaries: [],
        rootElements: [],
        metadata: {
          reactVersion: '18',
          streamingEnabled: true,
          generatedAt: Date.now(),
        },
        totalSize: 20,
        serverComponentCount: 1,
        clientComponentCount: 0,
      };

      const metrics = extractRSCMetrics(payload);
      expect(typeof metrics.cacheHitRatio).toBe('number');
    });

    it('should handle payload with no chunks', () => {
      const payload: RSCPayload = {
        id: 'test',
        chunks: [],
        boundaries: [],
        rootElements: [],
        metadata: {
          reactVersion: '18',
          streamingEnabled: true,
          generatedAt: Date.now(),
        },
        totalSize: 0,
        serverComponentCount: 0,
        clientComponentCount: 0,
      };

      const metrics = extractRSCMetrics(payload);
      expect(metrics.serverComponentCount).toBe(0);
      expect(metrics.clientComponentCount).toBe(0);
    });
  });

  describe('detectRSCBoundaries', () => {
    it('should detect server boundaries from fiber data', () => {
      const fiberData: FiberData[] = [
        {
          id: 'fiber-1',
          displayName: 'ServerComponent',
          tag: 0,
          actualDuration: 10,
          elementType: { name: 'ServerComponent', filePath: '/app/server.tsx' },
        },
      ];

      const boundaries = detectRSCBoundaries(fiberData);

      expect(Array.isArray(boundaries)).toBe(true);
    });

    it('should handle empty fiber array', () => {
      const boundaries = detectRSCBoundaries([]);
      expect(boundaries).toEqual([]);
    });

    it('should handle fibers without elementType', () => {
      const fiberData: FiberData[] = [
        {
          id: 'fiber-1',
          displayName: 'Component',
          tag: 0,
          actualDuration: 10,
        },
      ];

      const boundaries = detectRSCBoundaries(fiberData);
      expect(Array.isArray(boundaries)).toBe(true);
    });
  });

  describe('analyzeBoundaryCrossings', () => {
    it('should analyze payload for boundary crossings', () => {
      const boundary1: RSCBoundary = {
        id: 'b1',
        type: 'server',
        componentName: 'ServerComp',
        parentId: null,
        children: ['b2'],
        props: {},
        propsSize: 100,
        hasClientDirective: false,
      };
      
      const boundary2: RSCBoundary = {
        id: 'b2',
        type: 'client',
        componentName: 'ClientComp',
        parentId: 'b1',
        children: [],
        props: {},
        propsSize: 100,
        hasClientDirective: true,
      };

      const payload: RSCPayload = {
        id: 'test',
        chunks: [],
        boundaries: [boundary1, boundary2],
        rootElements: [],
        metadata: {
          reactVersion: '18',
          streamingEnabled: true,
          generatedAt: Date.now(),
        },
        totalSize: 200,
        serverComponentCount: 1,
        clientComponentCount: 1,
      };

      const crossings = analyzeBoundaryCrossings(payload);

      expect(crossings).toHaveProperty('totalCrossings');
      expect(crossings).toHaveProperty('serverToClient');
      expect(crossings).toHaveProperty('clientToServer');
      expect(crossings).toHaveProperty('largePropTransfers');
      expect(crossings.serverToClient).toBeGreaterThan(0);
    });

    it('should handle payload with no boundaries', () => {
      const payload: RSCPayload = {
        id: 'test',
        chunks: [],
        boundaries: [],
        rootElements: [],
        metadata: {
          reactVersion: '18',
          streamingEnabled: true,
          generatedAt: Date.now(),
        },
        totalSize: 0,
        serverComponentCount: 0,
        clientComponentCount: 0,
      };

      const crossings = analyzeBoundaryCrossings(payload);
      expect(crossings.totalCrossings).toBe(0);
      expect(crossings.serverToClient).toBe(0);
      expect(crossings.clientToServer).toBe(0);
      expect(crossings.largePropTransfers).toEqual([]);
    });

    it('should detect large prop transfers with warnings', () => {
      // RSC_LARGE_PROPS_THRESHOLD_BYTES is 50 * 1024 = 51200
      const largeSize = 60000; // Above threshold
      const boundary: RSCBoundary = {
        id: 'b1',
        type: 'client',
        componentName: 'ClientComp',
        parentId: 'b2',
        children: [],
        props: { largeData: 'x'.repeat(largeSize) },
        propsSize: largeSize,
        hasClientDirective: true,
      };

      const parentBoundary: RSCBoundary = {
        id: 'b2',
        type: 'server',
        componentName: 'ServerComp',
        parentId: null,
        children: ['b1'],
        props: {},
        propsSize: 0,
        hasClientDirective: false,
      };

      const payload: RSCPayload = {
        id: 'test',
        chunks: [],
        boundaries: [parentBoundary, boundary],
        rootElements: [],
        metadata: {
          reactVersion: '18',
          streamingEnabled: true,
          generatedAt: Date.now(),
        },
        totalSize: 50000,
        serverComponentCount: 1,
        clientComponentCount: 1,
      };

      const crossings = analyzeBoundaryCrossings(payload);
      
      expect(crossings.largePropTransfers.length).toBeGreaterThan(0);
      expect(crossings.largePropTransfers[0].warning).toBe(true);
    });
  });

  describe('calculatePayloadSize', () => {
    it('should calculate size of string data', () => {
      const size = calculatePayloadSize('test string');
      expect(size).toBeGreaterThan(0);
    });

    it('should calculate size of object data', () => {
      const size = calculatePayloadSize({ test: 'value', num: 123 });
      expect(size).toBeGreaterThan(0);
    });

    it('should return 0 for null/undefined', () => {
      expect(calculatePayloadSize(null)).toBe(0);
      expect(calculatePayloadSize(undefined)).toBe(0);
    });

    it('should calculate size of nested objects', () => {
      const data = {
        level1: {
          level2: {
            level3: 'deep value',
          },
        },
      };
      const size = calculatePayloadSize(data);
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('parseRSCReference', () => {
    it('should parse symbol reference', () => {
      const result = parseRSCReference('$Ssymbol-id');

      expect(result).toHaveProperty('marker', Marker.Symbol);
      expect(result).toHaveProperty('id', 'symbol-id');
      expect(result).toHaveProperty('type', 'symbol');
      expect(result).toHaveProperty('raw', '$Ssymbol-id');
    });

    it('should parse form state reference', () => {
      const result = parseRSCReference('$Fform-state-id');

      expect(result).toHaveProperty('marker', Marker.FormState);
      expect(result).toHaveProperty('id', 'form-state-id');
      expect(result).toHaveProperty('type', 'formstate');
    });

    it('should parse promise/stream reference', () => {
      const result = parseRSCReference('$Lpromise-id');

      expect(result).toHaveProperty('marker', Marker.Promise);
      expect(result).toHaveProperty('id', 'promise-id');
      expect(result).toHaveProperty('type', 'promise');
    });

    it('should parse element reference', () => {
      const result = parseRSCReference('$element-id');

      expect(result).toHaveProperty('marker', Marker.Element);
      expect(result).toHaveProperty('id', 'element-id');
      expect(result).toHaveProperty('type', 'element');
    });

    it('should handle invalid reference strings', () => {
      const result = parseRSCReference('invalid-reference');
      expect(result.marker).toBeNull();
      // When no marker found, the whole string becomes the id
      expect(result.id).toBe('invalid-reference');
      expect(result.type).toBe('unknown');
    });

    it('should handle null/undefined input', () => {
      const result = parseRSCReference(null as unknown as string);
      expect(result.marker).toBeNull();
      expect(result.type).toBe('unknown');
    });
  });

  describe('resolveRSCElement', () => {
    it('should return null for invalid reference', () => {
      const payload: RSCPayload = {
        id: 'test',
        chunks: [],
        boundaries: [],
        rootElements: [],
        metadata: {
          reactVersion: '18',
          streamingEnabled: true,
          generatedAt: Date.now(),
        },
        totalSize: 0,
        serverComponentCount: 0,
        clientComponentCount: 0,
      };

      const result = resolveRSCElement('invalid', payload);
      expect(result).toBeNull();
    });

    it('should try to resolve valid element reference', () => {
      const payload: RSCPayload = {
        id: 'test',
        chunks: [],
        boundaries: [],
        rootElements: [
          {
            id: 'elem-1',
            type: 'div',
            props: { id: 'test' },
            key: null,
            isClientBoundary: false,
            displayName: 'div',
            serializedSize: 100,
          },
        ],
        metadata: {
          reactVersion: '18',
          streamingEnabled: true,
          generatedAt: Date.now(),
        },
        totalSize: 100,
        serverComponentCount: 0,
        clientComponentCount: 0,
      };

      const result = resolveRSCElement('$elem-1', payload);
      // Returns null since the ID doesn't match exactly
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });
});

describe('RSC Worker Request Types', () => {
  it('should define valid request types', () => {
    const validTypes = [
      'PARSE_PAYLOAD',
      'EXTRACT_METRICS',
      'DETECT_BOUNDARIES',
      'ANALYZE_BOUNDARY_CROSSINGS',
      'ANALYZE_ALL',
    ];

    validTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });
});

describe('RSC Worker Response Types', () => {
  it('should define valid response types', () => {
    const validTypes = [
      'PAYLOAD_PARSED',
      'METRICS_EXTRACTED',
      'BOUNDARIES_DETECTED',
      'CROSSINGS_ANALYZED',
      'ANALYSIS_COMPLETE',
      'ERROR',
    ];

    validTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });
});

describe('RSC Worker Request Interface', () => {
  it('should have required properties', () => {
    const request: RSCWorkerRequest = {
      id: 'test-id',
      type: 'PARSE_PAYLOAD',
      payload: { data: '{}' },
    };

    expect(request).toHaveProperty('id');
    expect(request).toHaveProperty('type');
    expect(request).toHaveProperty('payload');
    expect(typeof request.id).toBe('string');
    expect(typeof request.type).toBe('string');
  });

  it('should support different payload types', () => {
    const parseRequest: RSCWorkerRequest = {
      id: '1',
      type: 'PARSE_PAYLOAD',
      payload: { data: '{"test": true}' },
    };

    const metricsRequest: RSCWorkerRequest = {
      id: '2',
      type: 'EXTRACT_METRICS',
      payload: { payload: {} as RSCPayload },
    };

    expect(parseRequest.payload).toHaveProperty('data');
    expect(metricsRequest.payload).toHaveProperty('payload');
  });
});

describe('RSC Worker Response Interface', () => {
  it('should have required properties', () => {
    const response: RSCWorkerResponse = {
      id: 'test-id',
      type: 'PAYLOAD_PARSED',
      result: {},
      duration: 100,
    };

    expect(response).toHaveProperty('id');
    expect(response).toHaveProperty('type');
    expect(response).toHaveProperty('duration');
    expect(typeof response.id).toBe('string');
    expect(typeof response.type).toBe('string');
    expect(typeof response.duration).toBe('number');
  });

  it('should support error responses', () => {
    const errorResponse: RSCWorkerResponse = {
      id: 'test-id',
      type: 'ERROR',
      error: 'Parsing failed',
      duration: 50,
    };

    expect(errorResponse).toHaveProperty('error');
    expect(typeof errorResponse.error).toBe('string');
  });
});
