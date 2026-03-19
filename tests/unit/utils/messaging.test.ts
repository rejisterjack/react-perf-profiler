import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PORT_NAMES,
  isValidPortName,
  generateMessageId,
  createCommitMessage,
  createStartProfilingMessage,
  createStopProfilingMessage,
  createClearDataMessage,
  createGetDataMessage,
  createComponentSelectedMessage,
  createAnalysisCompleteMessage,
  createErrorMessage,
  createInitMessage,
  createPingMessage,
  createPongMessage,
  VALID_RESULT,
  invalidResult,
  combineResults,
  validateNonEmptyString,
  validateNumberInRange,
  validateTimestamp,
  validateBaseMessage,
  validateCommitPayload,
  validateMessage,
  sendToBackground,
  sendToContent,
  isExtensionAvailable,
  pingBackground,
  waitForExtension,
} from '@/shared/messaging';
import { MessageTypeEnum } from '@/shared/constants';

describe('PORT_NAMES', () => {
  it('should have all expected port names', () => {
    expect(PORT_NAMES.CONTENT_BACKGROUND).toBeDefined();
    expect(PORT_NAMES.DEVTOOLS_BACKGROUND).toBeDefined();
    expect(PORT_NAMES.POPUP_BACKGROUND).toBeDefined();
    expect(PORT_NAMES.BACKGROUND_NATIVE).toBeDefined();
  });
});

describe('isValidPortName', () => {
  it('should return true for valid port names', () => {
    expect(isValidPortName(PORT_NAMES.CONTENT_BACKGROUND)).toBe(true);
    expect(isValidPortName(PORT_NAMES.DEVTOOLS_BACKGROUND)).toBe(true);
  });

  it('should return false for invalid port names', () => {
    expect(isValidPortName('invalid-port')).toBe(false);
    expect(isValidPortName('')).toBe(false);
  });
});

describe('generateMessageId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateMessageId();
    const id2 = generateMessageId();
    
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(0);
  });

  it('should include timestamp in ID', () => {
    const id = generateMessageId();
    const timestamp = parseInt(id.split('-')[0]);
    
    expect(timestamp).toBeGreaterThan(0);
    expect(timestamp).toBeLessThanOrEqual(Date.now());
  });
});

describe('message factories', () => {
  it('should create commit message', () => {
    const commit = {
      id: 'commit-1',
      timestamp: Date.now(),
      duration: 10,
    };
    
    const message = createCommitMessage(commit as any, 123);
    
    expect(message.type).toBe(MessageTypeEnum.COMMIT);
    expect(message.payload).toEqual({ commit });
    expect(message.tabId).toBe(123);
    expect(message.messageId).toBeDefined();
    expect(message.timestamp).toBeDefined();
  });

  it('should create start profiling message', () => {
    const config = { maxCommits: 100 };
    
    const message = createStartProfilingMessage(config, 123);
    
    expect(message.type).toBe(MessageTypeEnum.START_PROFILING);
    expect(message.payload?.config).toEqual(config);
    expect(message.payload?.timestamp).toBeDefined();
    expect(message.tabId).toBe(123);
  });

  it('should create stop profiling message', () => {
    const payload = {
      totalCommits: 10,
      totalDuration: 1000,
    };
    
    const message = createStopProfilingMessage(payload, 123);
    
    expect(message.type).toBe(MessageTypeEnum.STOP_PROFILING);
    expect(message.payload?.totalCommits).toBe(10);
    expect(message.payload?.totalDuration).toBe(1000);
    expect(message.payload?.timestamp).toBeDefined();
  });

  it('should create clear data message', () => {
    const message = createClearDataMessage(true, 123);
    
    expect(message.type).toBe(MessageTypeEnum.CLEAR_DATA);
    expect(message.payload?.preserveConfig).toBe(true);
    expect(message.tabId).toBe(123);
  });

  it('should create get data message', () => {
    const filters = { minDuration: 10 };
    
    const message = createGetDataMessage(filters, 123);
    
    expect(message.type).toBe(MessageTypeEnum.GET_DATA);
    expect(message.payload?.filters).toEqual(filters);
    expect(message.tabId).toBe(123);
  });

  it('should create component selected message', () => {
    const payload = {
      componentName: 'Test',
      fiberId: 'fiber-1',
      metrics: {} as any,
      commitId: 'commit-1',
    };
    
    const message = createComponentSelectedMessage(payload, 123);
    
    expect(message.type).toBe(MessageTypeEnum.COMPONENT_SELECTED);
    expect(message.payload).toEqual(payload);
    expect(message.tabId).toBe(123);
  });

  it('should create analysis complete message', () => {
    const reports = [{ componentName: 'Test' } as any];
    const summary = { totalComponents: 1 } as any;
    
    const message = createAnalysisCompleteMessage(reports, summary, 123);
    
    expect(message.type).toBe(MessageTypeEnum.ANALYSIS_COMPLETE);
    expect(message.payload?.reports).toEqual(reports);
    expect(message.payload?.summary).toEqual(summary);
    expect(message.payload?.timestamp).toBeDefined();
  });

  it('should create error message', () => {
    const message = createErrorMessage('ERR_001', 'Test error', 'test', 'stack', 123);
    
    expect(message.type).toBe(MessageTypeEnum.ERROR);
    expect(message.payload?.code).toBe('ERR_001');
    expect(message.payload?.message).toBe('Test error');
    expect(message.payload?.source).toBe('test');
    expect(message.payload?.stack).toBe('stack');
    expect(message.tabId).toBe(123);
  });

  it('should create init message', () => {
    const payload = {
      tabId: 123,
      url: 'http://example.com',
      reactDetected: true,
    };
    
    const message = createInitMessage(payload, 123);
    
    expect(message.type).toBe(MessageTypeEnum.INIT);
    expect(message.payload).toEqual(payload);
  });

  it('should create ping message', () => {
    const message = createPingMessage(123);
    
    expect(message.type).toBe(MessageTypeEnum.PING);
    expect(message.payload?.timestamp).toBeDefined();
    expect(message.tabId).toBe(123);
  });

  it('should create pong message', () => {
    const message = createPongMessage(123);
    
    expect(message.type).toBe(MessageTypeEnum.PONG);
    expect(message.payload?.timestamp).toBeDefined();
    expect(message.tabId).toBe(123);
  });
});

describe('validation utilities', () => {
  describe('VALID_RESULT', () => {
    it('should have valid true and empty errors', () => {
      expect(VALID_RESULT.valid).toBe(true);
      expect(VALID_RESULT.errors).toEqual([]);
    });
  });

  describe('invalidResult', () => {
    it('should create invalid result with error', () => {
      const result = invalidResult('Test error');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['Test error']);
    });
  });

  describe('combineResults', () => {
    it('should combine valid results', () => {
      const result = combineResults(VALID_RESULT, VALID_RESULT);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should combine errors from invalid results', () => {
      const result = combineResults(
        invalidResult('Error 1'),
        invalidResult('Error 2'),
        VALID_RESULT
      );
      
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['Error 1', 'Error 2']);
    });
  });

  describe('validateNonEmptyString', () => {
    it('should validate non-empty string', () => {
      const result = validateNonEmptyString('test', 'field');
      expect(result.valid).toBe(true);
    });

    it('should reject empty string', () => {
      const result = validateNonEmptyString('', 'field');
      expect(result.valid).toBe(false);
    });

    it('should reject whitespace-only string', () => {
      const result = validateNonEmptyString('   ', 'field');
      expect(result.valid).toBe(false);
    });

    it('should reject non-string values', () => {
      expect(validateNonEmptyString(null, 'field').valid).toBe(false);
      expect(validateNonEmptyString(undefined, 'field').valid).toBe(false);
      expect(validateNonEmptyString(123, 'field').valid).toBe(false);
    });
  });

  describe('validateNumberInRange', () => {
    it('should validate number in range', () => {
      const result = validateNumberInRange(5, 'field', 0, 10);
      expect(result.valid).toBe(true);
    });

    it('should reject numbers below min', () => {
      const result = validateNumberInRange(-1, 'field', 0, 10);
      expect(result.valid).toBe(false);
    });

    it('should reject numbers above max', () => {
      const result = validateNumberInRange(11, 'field', 0, 10);
      expect(result.valid).toBe(false);
    });

    it('should reject non-numbers', () => {
      expect(validateNumberInRange('5', 'field', 0, 10).valid).toBe(false);
      expect(validateNumberInRange(NaN, 'field', 0, 10).valid).toBe(false);
    });
  });

  describe('validateTimestamp', () => {
    it('should validate timestamp in valid range', () => {
      const result = validateTimestamp(Date.now(), 'field');
      expect(result.valid).toBe(true);
    });

    it('should reject timestamps before 2020', () => {
      const result = validateTimestamp(1577836800000 - 1, 'field');
      expect(result.valid).toBe(false);
    });

    it('should reject timestamps after 2030', () => {
      const result = validateTimestamp(1924991999999 + 1, 'field');
      expect(result.valid).toBe(false);
    });

    it('should reject non-numbers', () => {
      expect(validateTimestamp('now', 'field').valid).toBe(false);
    });
  });

  describe('validateBaseMessage', () => {
    it('should validate valid base message', () => {
      const message = { type: MessageTypeEnum.COMMIT };
      const result = validateBaseMessage(message);
      expect(result.valid).toBe(true);
    });

    it('should reject non-object messages', () => {
      expect(validateBaseMessage(null).valid).toBe(false);
      expect(validateBaseMessage('string').valid).toBe(false);
    });

    it('should reject messages without type', () => {
      const result = validateBaseMessage({});
      expect(result.valid).toBe(false);
    });

    it('should reject messages with invalid type', () => {
      const result = validateBaseMessage({ type: 'INVALID' });
      expect(result.valid).toBe(false);
    });
  });

  describe('validateCommitPayload', () => {
    it('should validate valid commit payload', () => {
      const payload = {
        commit: {
          id: 'commit-1',
          timestamp: Date.now(),
          duration: 10,
        },
      };
      const result = validateCommitPayload(payload);
      expect(result.valid).toBe(true);
    });

    it('should reject missing commit', () => {
      const result = validateCommitPayload({});
      expect(result.valid).toBe(false);
    });

    it('should reject invalid commit data', () => {
      const payload = {
        commit: {
          id: '',
          timestamp: Date.now(),
          duration: 10,
        },
      };
      const result = validateCommitPayload(payload);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateMessage', () => {
    it('should validate complete commit message', () => {
      const message = createCommitMessage({ id: 'c1', timestamp: Date.now(), duration: 10 } as any, 1);
      const result = validateMessage(message);
      expect(result.valid).toBe(true);
    });

    it('should reject message without payload when required', () => {
      const message = { type: MessageTypeEnum.COMMIT };
      const result = validateMessage(message);
      expect(result.valid).toBe(false);
    });

    it('should validate ping message (no payload required)', () => {
      const message = { type: MessageTypeEnum.PING };
      const result = validateMessage(message);
      expect(result.valid).toBe(true);
    });
  });
});

describe('extension utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isExtensionAvailable', () => {
    it('should return true when chrome.runtime is available', () => {
      expect(isExtensionAvailable()).toBe(true);
    });

    it('should return false when chrome.runtime throws', () => {
      // Save original chrome
      const originalChrome = global.chrome;
      
      // Replace chrome with a proxy that throws on access
      Object.defineProperty(global, 'chrome', {
        get: () => { throw new Error('Extension context invalidated'); },
        configurable: true,
      });
      
      expect(isExtensionAvailable()).toBe(false);
      
      // Restore chrome using defineProperty
      Object.defineProperty(global, 'chrome', {
        get: () => originalChrome,
        configurable: true,
      });
    });
  });

  describe('pingBackground', () => {
    it('should return false when extension not available', async () => {
      // Save original chrome
      const originalChrome = global.chrome;
      
      // Replace chrome with undefined
      Object.defineProperty(global, 'chrome', {
        get: () => undefined,
        configurable: true,
      });
      
      const result = await pingBackground();
      expect(result).toBe(false);
      
      // Restore chrome
      Object.defineProperty(global, 'chrome', {
        get: () => originalChrome,
        configurable: true,
      });
    });

    it('should return true on successful ping', async () => {
      const mockSendMessage = vi.fn((msg, callback) => {
        callback();
      });
      
      global.chrome.runtime.sendMessage = mockSendMessage;
      
      const result = await pingBackground();
      expect(result).toBe(true);
    });

    it('should return false on ping timeout', async () => {
      // Mock that never calls callback
      global.chrome.runtime.sendMessage = vi.fn();
      
      const result = await pingBackground(10); // 10ms timeout
      expect(result).toBe(false);
    });
  });

  describe('waitForExtension', () => {
    it('should resolve when extension becomes available', async () => {
      await expect(waitForExtension(1, 10)).resolves.toBeUndefined();
    });

    it('should reject after max attempts', async () => {
      // Save original chrome
      const originalChrome = global.chrome;
      
      // Replace chrome with undefined
      Object.defineProperty(global, 'chrome', {
        get: () => undefined,
        configurable: true,
      });
      
      await expect(waitForExtension(2, 10)).rejects.toThrow();
      
      // Restore chrome
      Object.defineProperty(global, 'chrome', {
        get: () => originalChrome,
        configurable: true,
      });
    });
  });
});
