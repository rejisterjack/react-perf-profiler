/**
 * Import Dialog Component
 * Allows importing profiler data from JSON files
 */

import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { Icon } from '../Icon/Icon';
import styles from './ImportDialog.module.css';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ImportPreview {
  version: string;
  commitCount: number;
  exportedAt: string;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importData = useProfilerStore((state) => state.importData);

  const resetState = useCallback(() => {
    setError(null);
    setPreview(null);
    setFileContent(null);
    setIsDragOver(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const validateAndPreview = useCallback((content: string): boolean => {
    try {
      const data = JSON.parse(content);

      if (!data.commits || !Array.isArray(data.commits)) {
        setError('Invalid file format: missing commits array');
        return false;
      }

      setPreview({
        version: data.version || 'unknown',
        commitCount: data.commits.length,
        exportedAt: data.exportedAt ? new Date(data.exportedAt).toLocaleString() : 'unknown',
      });

      setError(null);
      return true;
    } catch (_err) {
      setError('Invalid JSON file');
      return false;
    }
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        setError('Please select a JSON file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (validateAndPreview(content)) {
          setFileContent(content);
        }
      };
      reader.onerror = () => {
        setError('Failed to read file');
      };
      reader.readAsText(file);
    },
    [validateAndPreview]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0]) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0 && files[0]) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleImport = useCallback(() => {
    if (!fileContent) return;

    try {
      importData(fileContent);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  }, [fileContent, importData, handleClose]);

  if (!isOpen) return null;

  return (
    <div className={styles["overlay"]} onClick={handleClose}>
      <div className={styles["dialog"]} onClick={(e) => e.stopPropagation()}>
        <div className={styles["header"]}>
          <h2 className={styles["title"]}>Import Profile Data</h2>
          <button className={styles["closeButton"]} onClick={handleClose} aria-label="Close dialog">
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className={styles["content"]}>
          <div
            className={`${styles["dropZone"]} ${isDragOver ? styles["dragOver"] : ''}`}
            onClick={handleClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className={styles["dropZoneIcon"]}>📁</div>
            <div className={styles["dropZoneText"]}>Drop a JSON file here, or click to browse</div>
            <div className={styles["dropZoneHint"]}>
              Supports files exported from React Perf Profiler
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className={styles["fileInput"]}
            onChange={handleFileInput}
          />

          {error && <div className={styles["error"]}>{error}</div>}

          {preview && (
            <div className={styles["preview"]}>
              <div className={styles["previewTitle"]}>File Preview</div>
              <div className={styles["previewItem"]}>
                <span className={styles["previewLabel"]}>Version</span>
                <span className={styles["previewValue"]}>{preview.version}</span>
              </div>
              <div className={styles["previewItem"]}>
                <span className={styles["previewLabel"]}>Commits</span>
                <span className={styles["previewValue"]}>{preview.commitCount}</span>
              </div>
              <div className={styles["previewItem"]}>
                <span className={styles["previewLabel"]}>Exported</span>
                <span className={styles["previewValue"]}>{preview.exportedAt}</span>
              </div>
            </div>
          )}
        </div>

        <div className={styles["footer"]}>
          <button className={styles["cancelButton"]} onClick={handleClose}>
            Cancel
          </button>
          <button className={styles["importButton"]} onClick={handleImport} disabled={!fileContent}>
            Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;
