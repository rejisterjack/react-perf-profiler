/**
 * Import Dialog Component
 * Allows importing profiler data from JSON files with drag-and-drop support,
 * version detection and migration
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import type { ImportValidationResult, ImportPreview } from '@/shared/types/export';
import { Icon } from '../Icon/Icon';
import styles from './ImportDialog.module.css';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type DropZoneState = 'idle' | 'active' | 'error';

export const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose }) => {
  const [dropZoneState, setDropZoneState] = useState<DropZoneState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [validation, setValidation] = useState<ImportValidationResult | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [announceMessage, setAnnounceMessage] = useState<string>('');
  const dragCounterRef = useRef(0);
  const dragLeaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importDataWithMigration = useProfilerStore((state) => state.importDataWithMigration);
  const validateImportData = useProfilerStore((state) => state.validateImportData);

  const resetState = useCallback(() => {
    setError(null);
    setWarning(null);
    setPreview(null);
    setValidation(null);
    setFileContent(null);
    setDropZoneState('idle');
    setAnnounceMessage('');
    dragCounterRef.current = 0;
    if (dragLeaveTimeoutRef.current) {
      clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
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
    };
  }, []);

  const validateAndPreview = useCallback((content: string): boolean => {
    const result = validateImportData(content);
    setValidation(result);

    if (!result.isValid) {
      setError(result.error || 'Invalid file format');
      setPreview(null);
      setAnnounceMessage(`Error: ${result.error || 'Invalid file format'}`);
      return false;
    }

    setPreview(result.preview || null);
    setWarning(result.warning || null);
    setError(null);
    return true;
  }, [validateImportData]);

  const isValidJsonFile = useCallback((file: File): boolean => {
    return file.type === 'application/json' || file.name.endsWith('.json');
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (!isValidJsonFile(file)) {
        setError('Please select a JSON file');
        setDropZoneState('error');
        setAnnounceMessage('Error: Please select a JSON file only.');
        return;
      }

      setAnnounceMessage(`File "${file.name}" selected. Loading preview...`);

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (validateAndPreview(content)) {
          setFileContent(content);
          const commitCount = JSON.parse(content)?.commits?.length || 0;
          setAnnounceMessage(`Preview loaded. ${commitCount} commits ready to import.`);
        }
      };
      reader.onerror = () => {
        setError('Failed to read file');
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

    // Set drop effect to indicate this is a valid drop target
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current -= 1;

    // Only hide overlay when leaving the entire drop zone (not child elements)
    if (dragCounterRef.current === 0) {
      // Add small delay to prevent flicker when moving between child elements
      dragLeaveTimeoutRef.current = setTimeout(() => {
        setDropZoneState('idle');
        dragCounterRef.current = 0;
      }, 50);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Reset drag counter
      dragCounterRef.current = 0;
      setDropZoneState('idle');

      // Clear any pending timeout
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
          setAnnounceMessage('Error: Only JSON files are supported.');
          return;
        }

        handleFile(file);
      }
    },
    [handleFile, isValidJsonFile]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0 && files[0]) {
        handleFile(files[0]);
      }
      // Reset input so the same file can be selected again
      e.target.value = '';
    },
    [handleFile]
  );

  const handleImport = useCallback(() => {
    if (!fileContent) return;

    const result = importDataWithMigration(fileContent);
    
    if (result.success) {
      setAnnounceMessage('Import successful.');
      handleClose();
    } else {
      const errorMessage = result.error || 'Import failed';
      setError(errorMessage);
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
    // Determine badge color based on version status
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

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className={styles['fileInput']}
            onChange={handleFileInput}
            aria-label="File input for JSON profile data"
            tabIndex={-1}
          />

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

          {renderWarning()}

          {preview && (
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
          >
            Cancel
          </button>
          <button 
            className={styles['importButton']} 
            onClick={handleImport} 
            disabled={!fileContent}
            aria-disabled={!fileContent}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;
