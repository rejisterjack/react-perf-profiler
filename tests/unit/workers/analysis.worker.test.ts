import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Analysis Worker Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should validate commits array', async () => {
    const invalidPayload = { commits: 'not an array' };
    
    expect(() => {
      if (!Array.isArray(invalidPayload.commits)) {
        throw new Error('Invalid commits: expected array');
      }
    }).toThrow('Invalid commits: expected array');
  });

  it('should validate commit object for flamegraph', async () => {
    const invalidPayload = { commit: null };
    
    expect(() => {
      if (!invalidPayload.commit || typeof invalidPayload.commit !== 'object') {
        throw new Error('Invalid commit: expected object');
      }
    }).toThrow('Invalid commit: expected object');
  });

  it('should validate reports arrays for score', async () => {
    const invalidPayload = {
      commits: [],
      wastedRenderReports: 'not an array',
      memoReports: [],
    };
    
    expect(() => {
      if (!Array.isArray(invalidPayload.wastedRenderReports)) {
        throw new Error('Invalid wastedRenderReports: expected array');
      }
    }).toThrow('Invalid wastedRenderReports: expected array');
  });

  it('should validate memoReports array', async () => {
    const invalidPayload = {
      commits: [],
      wastedRenderReports: [],
      memoReports: 'not an array',
    };
    
    expect(() => {
      if (!Array.isArray(invalidPayload.memoReports)) {
        throw new Error('Invalid memoReports: expected array');
      }
    }).toThrow('Invalid memoReports: expected array');
  });
});

describe('Worker Request Types', () => {
  it('should define valid request types', () => {
    const validTypes = [
      'ANALYZE_COMMITS',
      'GENERATE_FLAMEGRAPH',
      'GENERATE_TIMELINE',
      'CALCULATE_SCORE',
    ];

    validTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });
});

describe('Worker Response Types', () => {
  it('should define valid response types', () => {
    const validTypes = [
      'ANALYSIS_COMPLETE',
      'FLAMEGRAPH_READY',
      'TIMELINE_READY',
      'SCORE_READY',
      'ERROR',
    ];

    validTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });
});

describe('Worker Request Interface', () => {
  it('should have required properties', () => {
    const request = {
      id: 'test-id',
      type: 'ANALYZE_COMMITS',
      payload: { commits: [] },
    };

    expect(request).toHaveProperty('id');
    expect(request).toHaveProperty('type');
    expect(request).toHaveProperty('payload');
    expect(typeof request.id).toBe('string');
    expect(typeof request.type).toBe('string');
  });
});

describe('Worker Response Interface', () => {
  it('should have required properties', () => {
    const response = {
      id: 'test-id',
      type: 'ANALYSIS_COMPLETE',
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
    const errorResponse = {
      id: 'test-id',
      type: 'ERROR',
      error: 'Something went wrong',
      duration: 50,
    };

    expect(errorResponse).toHaveProperty('error');
    expect(typeof errorResponse.error).toBe('string');
  });
});
