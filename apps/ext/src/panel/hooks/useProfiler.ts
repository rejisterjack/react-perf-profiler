import { useCallback } from 'react';
import { browser } from 'wxt/browser';
import { MessageTypeEnum } from '@/src/shared/constants';

interface ProfilerControls {
  startProfiling: () => void;
  stopProfiling: () => void;
  clearData: () => void;
}

/**
 * Provides profiling control functions that send commands to the extension
 * background script via browser.runtime.sendMessage.
 */
export function useProfiler(): ProfilerControls {
  const startProfiling = useCallback(() => {
    browser.runtime.sendMessage({
      type: MessageTypeEnum.START_PROFILING,
    });
  }, []);

  const stopProfiling = useCallback(() => {
    browser.runtime.sendMessage({
      type: MessageTypeEnum.STOP_PROFILING,
    });
  }, []);

  const clearData = useCallback(() => {
    browser.runtime.sendMessage({
      type: MessageTypeEnum.CLEAR_DATA,
    });
  }, []);

  return { startProfiling, stopProfiling, clearData };
}
