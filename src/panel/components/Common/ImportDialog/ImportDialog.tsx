/**
 * Import Dialog Component
 * Allows importing profiler data from JSON files with drag-and-drop support,
 * version detection, migration, and preview
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import type { ImportValidationResult, ImportPreview } from '@/shared/types/export';
import type { MigrationLogEntry } from '@/shared/types/export';
import { isCompressedExport, decompressData } from '@/shared/export/compression';
import { Icon } from '../Icon/Icon';
import styles from './ImportDialog.module.css';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type DropZoneState = 'idle' | 'active' | 'error';
type ImportState = 'idle' | 'reading' | 'validating' | 'migrating' | 'preview' | 'importing' | 'complete' | 'error';

interface FileInfo {
  name: string;
  size: number;
  compressed: boolean;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose }) => {
  const [dropZoneState, setDropZoneState] = useState<DropZoneState>('idle');
  const [importState, setImportState] = useState<ImportState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [validation, setValidation] = useState<ImportValidationResult | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [, setMigrationLog] = useState<MigrationLogEntry[] | null>(null);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [announceMessage, setAnnounceMessage] = useState<string>('');
  const [isCompressed, setIsCompressed] = useState(false);
  
  const dragCounterRef = useRef(0);
  const dragLeaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const migrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const migrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const importDataWithMigration = useProfilerStore((state) => state.importDataWithMigration);
  const validateImportData = useProfilerStore((state) => state.validateImportData);

  const resetState = useCallback(() => {
    setError(null);
    setWarning(null);
    setPreview(null);
    setValidation(null);
    setFileContent(null);
    setFileInfo(null);
    setMigrationLog(null);
    setMigrationProgress(0);
    setDropZoneState('idle');
    setImportState('idle');
    setAnnounceMessage('');
    setIsCompressed(false);
    dragCounterRef.current = 0;
    
    if (dragLeaveTimeoutRef.current) {
      clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
    if (migrationIntervalRef.current) {
      clearInterval(migrationIntervalRef.current);
      migrationIntervalRef.current = null;
    }
    if (migrationTimeoutRef.current) {
      clearTimeout(migrationTimeoutRef.current);
      migrationTimeoutRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (dragLeaveTimeoutRef.current) {
        clearTimeout(dragLeaveTimeoutRef.current);
      }
      if (migrationTimeoutRef.current) {
        clearTimeout(migrationTimeoutRef.current);
      }
      if (migrationIntervalRef.current) {
        clearInterval(migrationIntervalRef.current);
      }
    };
  }, []);

  // Format file size for display
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  }, []);

  // Validate and preview file content
  const validateAndPreview = useCallback(async (content: string, info: FileInfo): Promise<boolean> => {
    setImportState('validating');
    setAnnounceMessage('Validating file...');

    try {
      // Check if compressed
      let parsedContent: unknown;
      let decompressedContent = content;
      let wasCompressed = false;

      try {
        parsedContent = JSON.parse(content);
        
        if (isCompressedExport(parsedContent)) {
          wasCompressed = true;
          setIsCompressed(true);
          setAnnounceMessage('Decompressing file...');
          
          const result = await decompressData(parsedContent);
          if (!result.success) {
            setError(result.error || 'Failed to decompress file');
            setImportState('error');
            setAnnounceMessage(`Error: ${result.error || 'Failed to decompress file'}`);
            return false;
          }
          decompressedContent = result.data;
          parsedContent = JSON.parse(result.data);
        }
      } catch {
        setError('Invalid JSON file');
        setImportState('error');
        setAnnounceMessage('Error: Invalid JSON file');
        return false;
      }

      // Validate the data
      const result = validateImportData(decompressedContent);
      setValidation(result);

      if (!result.isValid) {
        setError(result.error || 'Invalid file format');
        setPreview(null);
        setImportState('error');
        setAnnounceMessage(`Error: ${result.error || 'Invalid file format'}`);
        return false;
      }

      // Check if migration is needed
      if (result.migrationAvailable) {
        setImportState('migrating');
        setAnnounceMessage('Migrating profile to current format...');
        
        // Simulate migration progress — tracked in a ref so it's cleared on unmount
        let progress = 0;
        migrationIntervalRef.current = setInterval(() => {
          progress += 20;
          setMigrationProgress(progress);
          if (progress >= 100) {
            clearInterval(migrationIntervalRef.current!);
            migrationIntervalRef.current = null;
          }
        }, 100);

        // Store content for import
        setFileContent(decompressedContent);
      } else {
        setFileContent(decompressedContent);
      }

      setPreview(result.preview || null);
      setWarning(result.warning || null);
      setFileInfo({ ...info, compressed: wasCompressed });
      setImportState('preview');
      setAnnounceMessage(
        `Preview loaded. ${result.preview?.commitCount || 0} commits ready to import.`
      );
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Validation failed';
      setError(errorMsg);
      setImportState('error');
      setAnnounceMessage(`Error: ${errorMsg}`);
      return false;
    }
  }, [validateImportData]);

  const isValidJsonFile = useCallback((file: File): boolean => {
    return file.type === 'application/json' || file.name.endsWith('.json');
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (!isValidJsonFile(file)) {
        setError('Please select a JSON file');
        setDropZoneState('error');
        setImportState('error');
        setAnnounceMessage('Error: Please select a JSON file only.');
        return;
      }

      setImportState('reading');
      setAnnounceMessage(`File "${file.name}" selected. Loading preview...`);

      const info: FileInfo = {
        name: file.name,
        size: file.size,
        compressed: false,
      };

      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        await validateAndPreview(content, info);
      };
      reader.onerror = () => {
        setError('Failed to read file');
        setImportState('error');
        setAnnounceMessage('Error: Failed to read file.');
      };
      reader.readAsText(file);
    },
    [validateAndPreview, isValidJsonFile]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current += 1;

    // Clear any pending drag leave timeout
    if (dragLeaveTimeoutRef.current) {
      clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }

    // Check if any of the dragged files are not valid JSON
    const items = e.dataTransfer.items;
    let hasInvalidFile = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item?.kind === 'file') {
        const file = item.getAsFile();
        if (file && !isValidJsonFile(file)) {
          hasInvalidFile = true;
          break;
        }
      }
    }

    if (hasInvalidFile) {
      setDropZoneState('error');
    } else {
      setDropZoneState('active');
      setAnnounceMessage('File dragged over drop zone. Release to import.');
    }
  }, [isValidJsonFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current -= 1;

    if (dragCounterRef.current === 0) {
      dragLeaveTimeoutRef.current = setTimeout(() => {
        setDropZoneState('idle');
        dragCounterRef.current = 0;
      }, 50);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      dragCounterRef.current = 0;
      setDropZoneState('idle');

      if (dragLeaveTimeoutRef.current) {
        clearTimeout(dragLeaveTimeoutRef.current);
        dragLeaveTimeoutRef.current = null;
      }

      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0]) {
        const file = files[0];
        
        if (!isValidJsonFile(file)) {
          setError('Please drop a JSON file');
          setDropZoneState('error');
          setImportState('error');
          setAnnounceMessage('Error: Only JSON files are supported.');
          return;
        }

        await handleFile(file);
      }
    },
    [handleFile, isValidJsonFile]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0 && files[0]) {
        await handleFile(files[0]);
      }
      // Reset input so the same file can be selected again
      e.target.value = '';
    },
    [handleFile]
  );

  const handleImport = useCallback(async () => {
    if (!fileContent) return;

    setImportState('importing');
    setAnnounceMessage('Importing profile data...');

    const result = importDataWithMigration(fileContent);
    
    if (result.success) {
      setImportState('complete');
      setAnnounceMessage(result.migrated 
        ? 'Import successful. Profile migrated to current format.' 
        : 'Import successful.');
      
      // Delay close to show success state
      migrationTimeoutRef.current = setTimeout(() => {
        handleClose();
      }, 1000);
    } else {
      const errorMessage = result.error || 'Import failed';
      setError(errorMessage);
      setImportState('error');
      setAnnounceMessage(`Error: ${errorMessage}`);
    }
  }, [fileContent, importDataWithMigration, handleClose]);

  const getDropZoneClassName = () => {
    const baseClass = styles['dropZone'];
    switch (dropZoneState) {
      case 'active':
        return `${baseClass} ${styles['dropZoneActive']}`;
      case 'error':
        return `${baseClass} ${styles['dropZoneError']}`;
      default:
        return baseClass;
    }
  };

  const getDropZoneIcon = () => {
    switch (dropZoneState) {
      case 'active':
        return <Icon name="upload" size={48} className={styles['dropZoneActiveIcon']} ariaLabel="Ready to drop" />;
      case 'error':
        return <Icon name="warning" size={48} className={styles['dropZoneErrorIcon']} ariaLabel="Invalid file type" />;
      default:
        return <Icon name="upload" size={48} className={styles['dropZoneIcon']} ariaLabel="Drop zone" />;
    }
  };

  const getDropZoneMessage = () => {
    switch (dropZoneState) {
      case 'active':
        return 'Drop to import profile';
      case 'error':
        return 'Only JSON files are accepted';
      default:
        return 'Drop a JSON file here, or click to browse';
    }
  };

  const renderVersionBadge = (version: string) => {
    let badgeClass = styles['versionBadge'];
    if (validation?.isSupported) {
      badgeClass += ` ${styles['versionSupported']}`;
    } else if (validation?.migrationAvailable) {
      badgeClass += ` ${styles['versionMigrated']}`;
    } else {
      badgeClass += ` ${styles['versionUnsupported']}`;
    }

    return (
      <span className={badgeClass}>
        {version}
        {validation?.migrationAvailable && (
          <span className={styles['migrationIndicator']}> (will migrate)</span>
        )}
      </span>
    );
  };

  const renderWarning = () => {
    if (!warning) return null;

    return (
      <div className={styles['warning']} role="alert">
        <Icon name="warning" size={16} />
        <span>{warning}</span>
      </div>
    );
  };

  const renderMigrationProgress = () => {
    if (importState !== 'migrating') return null;

    return (
      <div className={styles['migrationProgress']}>
        <div className={styles['migrationProgressHeader']}>
          <Icon name="refresh" size={16} className={styles['migrationIcon']} />
          <span>Migrating profile format...</span>
        </div>
        <div className={styles['progressBarContainer']}>
          <div 
            className={styles['progressBar']} 
            style={{ width: `${migrationProgress}%` }}
            role="progressbar"
            aria-valuenow={migrationProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <span className={styles['progressText']}>{migrationProgress}%</span>
      </div>
    );
  };

  const renderFileInfo = () => {
    if (!fileInfo) return null;

    return (
      <div className={styles['fileInfo']}>
        <Icon name="component" size={16} />
        <span className={styles['fileName']}>{fileInfo.name}</span>
        <span className={styles['fileSize']}>({formatFileSize(fileInfo.size)})</span>
        {isCompressed && (
          <span className={`${styles['featureBadge']} ${styles['compressedBadge']}`}>
            Compressed
          </span>
        )}
      </div>
    );
  };

  const renderImportStats = () => {
    if (!preview) return null;

    const stats = [
      { label: 'Commits', value: preview.commitCount },
      { label: 'Components', value: preview.componentCount ?? 'Unknown' },
      { label: 'Duration', value: preview.recordingDuration ? `${(preview.recordingDuration / 1000).toFixed(1)}s` : 'Unknown' },
    ];

    return (
      <div className={styles['importStats']}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles['statItem']}>
            <span className={styles['statValue']}>{stat.value}</span>
            <span className={styles['statLabel']}>{stat.label}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderStateIndicator = () => {
    switch (importState) {
      case 'reading':
        return (
          <div className={styles['stateIndicator']}>
            <Icon name="spinner" size={24} className={styles['spinningIcon']} />
            <span>Reading file...</span>
          </div>
        );
      case 'validating':
        return (
          <div className={styles['stateIndicator']}>
            <Icon name="spinner" size={24} className={styles['spinningIcon']} />
            <span>Validating...</span>
          </div>
        );
      case 'importing':
        return (
          <div className={styles['stateIndicator']}>
            <Icon name="spinner" size={24} className={styles['spinningIcon']} />
            <span>Importing...</span>
          </div>
        );
      case 'complete':
        return (
          <div className={`${styles['stateIndicator']} ${styles['stateSuccess']}`}>
            <Icon name="check" size={24} />
            <span>Import complete!</span>
          </div>
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className={styles['overlay']} 
      onClick={handleClose}
      role="presentation"
    >
      {/* Screen reader announcements */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true" 
        className={styles['srOnly']}
      >
        {announceMessage}
      </div>

      <div 
        className={styles['dialog']} 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
      >
        <div className={styles['header']}>
          <h2 id="import-dialog-title" className={styles['title']}>Import Profile Data</h2>
          <button 
            className={styles['closeButton']} 
            onClick={handleClose} 
            aria-label="Close dialog"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className={styles['content']}>
          {/* Drop Zone - only show in idle state */}
          {importState === 'idle' && (
            <div
              className={getDropZoneClassName()}
              onClick={handleClick}
              onDrop={handleDrop}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              role="button"
              aria-label="Drop zone for JSON file. Click to browse or drag and drop a file."
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClick();
                }
              }}
            >
              <div className={styles['dropZoneIconWrapper']}>
                {getDropZoneIcon()}
              </div>
              <div className={styles['dropZoneText']}>
                {getDropZoneMessage()}
              </div>
              <div className={styles['dropZoneHint']}>
                <Icon name="info" size={14} />
                <span>Supports files exported from React Perf Profiler</span>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className={styles['fileInput']}
            onChange={handleFileInput}
            aria-label="File input for JSON profile data"
            tabIndex={-1}
          />

          {/* State indicators */}
          {renderStateIndicator()}
          {renderMigrationProgress()}

          {/* File info */}
          {renderFileInfo()}

          {/* Error message */}
          {error && (
            <div 
              className={styles['error']} 
              role="alert" 
              aria-live="assertive"
            >
              <Icon name="error" size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Warning message */}
          {renderWarning()}

          {/* Import Stats */}
          {preview && renderImportStats()}

          {/* Preview section */}
          {preview && importState === 'preview' && (
            <div className={styles['preview']}>
              <div className={styles['previewTitle']}>File Preview</div>
              
              <div className={styles['previewItem']}>
                <span className={styles['previewLabel']}>Format Version</span>
                <span className={styles['previewValue']}>
                  {renderVersionBadge(preview.version)}
                </span>
              </div>

              <div className={styles['previewItem']}>
                <span className={styles['previewLabel']}>Commits</span>
                <span className={styles['previewValue']}>{preview.commitCount}</span>
              </div>

              {preview.componentCount !== undefined && (
                <div className={styles['previewItem']}>
                  <span className={styles['previewLabel']}>Components</span>
                  <span className={styles['previewValue']}>{preview.componentCount}</span>
                </div>
              )}

              <div className={styles['previewItem']}>
                <span className={styles['previewLabel']}>Exported</span>
                <span className={styles['previewValue']}>
                  {preview.exportedAt === 'unknown' 
                    ? 'Unknown' 
                    : new Date(preview.exportedAt).toLocaleString()}
                </span>
              </div>

              <div className={styles['previewItem']}>
                <span className={styles['previewLabel']}>Profiler Version</span>
                <span className={styles['previewValue']}>
                  {preview.profilerVersion}
                </span>
              </div>

              {preview.reactVersion && preview.reactVersion !== 'unknown' && (
                <div className={styles['previewItem']}>
                  <span className={styles['previewLabel']}>React Version</span>
                  <span className={styles['previewValue']}>{preview.reactVersion}</span>
                </div>
              )}

              {preview.recordingDuration !== undefined && (
                <div className={styles['previewItem']}>
                  <span className={styles['previewLabel']}>Recording Duration</span>
                  <span className={styles['previewValue']}>
                    {(preview.recordingDuration / 1000).toFixed(2)}s
                  </span>
                </div>
              )}

              {preview.sourceUrl && (
                <div className={styles['previewItem']}>
                  <span className={styles['previewLabel']}>Source</span>
                  <span className={styles['previewValue']} title={preview.sourceUrl}>
                    {new URL(preview.sourceUrl).hostname}
                  </span>
                </div>
              )}

              {preview.hasAnalysis && (
                <div className={styles['previewItem']}>
                  <span className={styles['previewLabel']}>Analysis</span>
                  <span className={`${styles['previewValue']} ${styles['featureBadge']}`}>
                    Included
                  </span>
                </div>
              )}

              {preview.hasRSCData && (
                <div className={styles['previewItem']}>
                  <span className={styles['previewLabel']}>RSC Data</span>
                  <span className={`${styles['previewValue']} ${styles['featureBadge']}`}>
                    Included
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles['footer']}>
          <button 
            className={styles['cancelButton']} 
            onClick={handleClose}
            disabled={importState === 'importing'}
          >
            Cancel
          </button>
          <button 
            className={styles['importButton']} 
            onClick={handleImport} 
            disabled={!fileContent || importState === 'importing' || importState === 'migrating'}
            aria-disabled={!fileContent || importState === 'importing' || importState === 'migrating'}
          >
            {importState === 'importing' ? 'Importing...' : 
             importState === 'migrating' ? 'Migrating...' : 
             validation?.migrationAvailable ? 'Import & Migrate' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;
