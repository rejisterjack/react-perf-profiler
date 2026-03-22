/**
 * Hook for exporting and importing profiler data
 * @module panel/hooks/useExport
 */

import { useCallback, useState, useRef } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import type { AnalysisResult, CommitData } from '@/shared/types';
import { logger } from '@/shared/logger';

/**
 * Export progress state
 */
export interface ExportProgress {
  /** Whether export is in progress */
  isExporting: boolean;
  /** Export progress (0-100) */
  progress: number;
  /** Current stage message */
  message: string;
}

/**
 * Import progress state
 */
export interface ImportProgress {
  /** Whether import is in progress */
  isImporting: boolean;
  /** Import progress (0-100) */
  progress: number;
  /** Current stage message */
  message: string;
  /** Validation errors */
  validationErrors: string[];
}

/**
 * Return type for useExport hook
 */
export interface UseExportReturn {
  /** Export progress state */
  exportProgress: ExportProgress;
  /** Import progress state */
  importProgress: ImportProgress;
  /** Export profiling data to file */
  exportData: (options?: ExportOptions) => Promise<void>;
  /** Import profiling data from file */
  importData: (file: File) => Promise<void>;
  /** Cancel ongoing export/import */
  cancel: () => void;
  /** Clear any errors */
  clearErrors: () => void;
  /** Last error message */
  error: string | null;
}

/**
 * Options for export operation
 */
export interface ExportOptions {
  /** Filename for the export (without extension) */
  filename?: string;
  /** Whether to include raw commit data */
  includeRawData?: boolean;
  /** Whether to minify the output */
  minify?: boolean;
}

/**
 * Export data structure
 */
interface ExportData {
  version: string;
  exportedAt: number;
  commits: CommitData[];
  componentData: Record<string, unknown>;
  analysisResults?: AnalysisResult | null;
  performanceScore?: unknown;
  settings?: Record<string, unknown>;
  metadata: {
    totalCommits: number;
    totalComponents: number;
    exportDuration: number;
    userAgent: string;
    url: string;
  };
}

/**
 * Hook for exporting and importing profiler data with progress tracking
 *
 * @example
 * ```tsx
 * function ExportButton() {
 *   const { exportData, exportProgress, error } = useExport();
 *
 *   return (
 *     <div>
 *       <button onClick={() => exportData()} disabled={exportProgress.isExporting}>
 *         {exportProgress.isExporting 
 *           ? `Exporting... ${exportProgress.progress}%` 
 *           : 'Export Data'}
 *       </button>
 *       {error && <div className="error">{error}</div>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @returns Object containing export/import functions and state
 */
export function useExport(): UseExportReturn {
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    isExporting: false,
    progress: 0,
    message: '',
  });
  
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    isImporting: false,
    progress: 0,
    message: '',
    validationErrors: [],
  });
  
  const [error, setError] = useState<string | null>(null);
  
  // Use ref for abort controller to allow cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Access store state
  const store = useProfilerStore.getState();

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setError(null);
    setImportProgress(prev => ({ ...prev, validationErrors: [] }));
  }, []);

  /**
   * Cancel ongoing export/import operation
   */
  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    
    setExportProgress({
      isExporting: false,
      progress: 0,
      message: 'Cancelled',
    });
    
    setImportProgress(prev => ({
      ...prev,
      isImporting: false,
      progress: 0,
      message: 'Cancelled',
    }));
  }, []);

  /**
   * Export profiling data to a JSON file
   */
  const exportData = useCallback(async (options: ExportOptions = {}): Promise<void> => {
    const {
      filename = `react-perf-profile-${new Date().toISOString().split('T')[0]}`,
      includeRawData = true,
      minify = false,
    } = options;

    // Create abort controller for this operation
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setExportProgress({
      isExporting: true,
      progress: 0,
      message: 'Preparing data...',
    });
    setError(null);

    try {
      // Stage 1: Collect data (0-30%)
      setExportProgress(prev => ({ ...prev, progress: 10 }));
      
      // Convert Map to Record for serialization
      const componentDataRecord: Record<string, unknown> = {};
      store.componentData.forEach((value, key) => {
        componentDataRecord[key] = value;
      });

      const exportData: ExportData = {
        version: '1.0.0',
        exportedAt: Date.now(),
        commits: includeRawData ? store.commits : [],
        componentData: componentDataRecord,
        analysisResults: store.analysisResults,
        performanceScore: store.performanceScore,
        settings: {
          theme: localStorage.getItem('theme') || 'system',
        },
        metadata: {
          totalCommits: store.commits.length,
          totalComponents: store.componentData.size,
          exportDuration: 0,
          userAgent: navigator.userAgent,
          url: window.location.href,
        },
      };

      if (signal.aborted) throw new Error('Export cancelled');

      // Stage 2: Serialize data (30-70%)
      setExportProgress({
        isExporting: true,
        progress: 40,
        message: 'Serializing data...',
      });

      const jsonString = JSON.stringify(exportData, null, minify ? undefined : 2);
      
      if (signal.aborted) throw new Error('Export cancelled');

      // Stage 3: Create and download file (70-100%)
      setExportProgress({
        isExporting: true,
        progress: 80,
        message: 'Creating download...',
      });

      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);

      if (signal.aborted) throw new Error('Export cancelled');

      // Complete
      setExportProgress({
        isExporting: false,
        progress: 100,
        message: 'Export complete!',
      });

      // Reset after a delay
      setTimeout(() => {
        setExportProgress({
          isExporting: false,
          progress: 0,
          message: '',
        });
      }, 2000);

    } catch (err) {
      if (signal.aborted || (err instanceof Error && err.message === 'Export cancelled')) {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setError(errorMessage);
      setExportProgress({
        isExporting: false,
        progress: 0,
        message: 'Export failed',
      });

      logger.error('Export error', { error: err instanceof Error ? err.message : String(err), source: 'useExport' });
    } finally {
      abortControllerRef.current = null;
    }
  }, [store]);

  /**
   * Import profiling data from a JSON file
   */
  const importData = useCallback(async (file: File): Promise<void> => {
    // Create abort controller for this operation
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setImportProgress({
      isImporting: true,
      progress: 0,
      message: 'Reading file...',
      validationErrors: [],
    });
    setError(null);

    try {
      // Stage 1: Read file (0-30%)
      const fileContent = await readFileAsText(file);
      
      if (signal.aborted) throw new Error('Import cancelled');

      setImportProgress({
        isImporting: true,
        progress: 30,
        message: 'Parsing JSON...',
        validationErrors: [],
      });

      // Stage 2: Parse JSON (30-50%)
      let parsedData: ExportData;
      try {
        parsedData = JSON.parse(fileContent) as ExportData;
      } catch {
        throw new Error('Invalid JSON file. Please select a valid profiler export.');
      }

      if (signal.aborted) throw new Error('Import cancelled');

      // Stage 3: Validate data (50-70%)
      setImportProgress({
        isImporting: true,
        progress: 50,
        message: 'Validating data...',
        validationErrors: [],
      });

      const validationErrors: string[] = [];

      // Check version
      if (!parsedData.version) {
        validationErrors.push('Missing version information');
      }

      // Check required fields
      if (!parsedData.commits && !parsedData.componentData) {
        validationErrors.push('No profiling data found in file');
      }

      if (validationErrors.length > 0) {
        setImportProgress(prev => ({
          ...prev,
          validationErrors,
        }));
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }

      if (signal.aborted) throw new Error('Import cancelled');

      // Stage 4: Import data (70-100%)
      setImportProgress({
        isImporting: true,
        progress: 70,
        message: 'Importing data...',
        validationErrors: [],
      });

      // Import commits
      if (parsedData.commits && Array.isArray(parsedData.commits)) {
        // Clear existing data first
        store.clearData?.();
        
        // Add imported commits
        for (const commit of parsedData.commits) {
          store.addCommit(commit);
        }
      }

      // Import analysis results
      if (parsedData.analysisResults) {
        store.setAnalysisResults(parsedData.analysisResults);
      }

      if (signal.aborted) throw new Error('Import cancelled');

      // Complete
      setImportProgress({
        isImporting: false,
        progress: 100,
        message: 'Import complete!',
        validationErrors: [],
      });

      // Reset after a delay
      setTimeout(() => {
        setImportProgress({
          isImporting: false,
          progress: 0,
          message: '',
          validationErrors: [],
        });
      }, 2000);

    } catch (err) {
      if (signal.aborted || (err instanceof Error && err.message === 'Import cancelled')) {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Import failed';
      setError(errorMessage);
      setImportProgress(prev => ({
        ...prev,
        isImporting: false,
        progress: 0,
        message: 'Import failed',
      }));

      logger.error('Import error', { error: err instanceof Error ? err.message : String(err), source: 'useExport' });
    } finally {
      abortControllerRef.current = null;
    }
  }, [store]);

  return {
    exportProgress,
    importProgress,
    exportData,
    importData,
    cancel,
    clearErrors,
    error,
  };
}

/**
 * Helper function to read file as text
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (event.target?.result) {
        resolve(event.target.result as string);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}

export default useExport;
