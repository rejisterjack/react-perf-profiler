/**
 * TreeSearch Component
 * Search and filter bar for the component tree view
 * Provides text filtering and severity-based filtering
 */

import React, { memo, useCallback, useRef, useEffect } from 'react';
import styles from './TreeSearch.module.css';

// Search icon SVG
const SearchIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle
      cx="7"
      cy="7"
      r="5"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M11 11L14 14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

// Clear icon SVG
const ClearIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M3 3L11 11M3 11L11 3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

// Filter icon SVG
const FilterIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M1 3H13M3 7H11M5 11H9"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Severity filter type
 */
export type SeverityFilter = 'critical' | 'warning' | 'info';

/**
 * Props for the TreeSearch component
 */
export interface TreeSearchProps {
  /** Current search value */
  value: string;
  /** Callback when search value changes */
  onChange: (value: string) => void;
  /** Active severity filters */
  severityFilter: SeverityFilter[];
  /** Callback when severity filters change */
  onSeverityFilterChange: (filters: SeverityFilter[]) => void;
  /** Optional placeholder text for search input */
  placeholder?: string;
  /** Optional className for styling */
  className?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Optional results count to display */
  resultsCount?: number;
  /** Optional total count for comparison */
  totalCount?: number;
}

/**
 * Individual severity filter button props
 */
interface SeverityButtonProps {
  severity: SeverityFilter;
  label: string;
  isActive: boolean;
  onToggle: (severity: SeverityFilter) => void;
  disabled?: boolean;
}

/**
 * Severity filter button component
 */
const SeverityButton: React.FC<SeverityButtonProps> = memo(({
  severity,
  label,
  isActive,
  onToggle,
  disabled,
}) => {
  const handleClick = useCallback(() => {
    onToggle(severity);
  }, [onToggle, severity]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle(severity);
    }
  }, [onToggle, severity]);

  return (
    <button
      className={`${styles.severityButton} ${styles[severity]} ${isActive ? styles.active : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      type="button"
      role="checkbox"
      aria-checked={isActive}
      aria-label={`Filter by ${label} severity`}
      title={`Toggle ${label} issues visibility`}
    >
      <span className={styles.severityIndicator} aria-hidden="true" />
      <span className={styles.severityLabel}>{label}</span>
    </button>
  );
});

SeverityButton.displayName = 'SeverityButton';

/**
 * TreeSearch - Search and filter bar for the component tree
 * 
 * Features:
 * - Text-based filtering with clear button
 * - Severity-based filtering (critical, warning, info)
 * - Results count display
 * - Keyboard accessibility
 * 
 * @example
 * ```tsx
 * <TreeSearch
 *   value={filterText}
 *   onChange={setFilterText}
 *   severityFilter={['critical', 'warning']}
 *   onSeverityFilterChange={setSeverityFilter}
 *   resultsCount={42}
 *   totalCount={100}
 * />
 * ```
 */
export const TreeSearch: React.FC<TreeSearchProps> = memo(({
  value,
  onChange,
  severityFilter,
  onSeverityFilterChange,
  placeholder = 'Filter components...',
  className,
  disabled = false,
  resultsCount,
  totalCount,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Focus input on mount
   */
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  /**
   * Handle severity filter toggle
   */
  const handleSeverityToggle = useCallback((severity: SeverityFilter) => {
    if (severityFilter.includes(severity)) {
      onSeverityFilterChange(severityFilter.filter(s => s !== severity));
    } else {
      onSeverityFilterChange([...severityFilter, severity]);
    }
  }, [severityFilter, onSeverityFilterChange]);

  /**
   * Handle input change
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  /**
   * Clear search input
   */
  const handleClear = useCallback(() => {
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Clear on Escape
    if (e.key === 'Escape' && value) {
      e.preventDefault();
      onChange('');
    }
  }, [value, onChange]);

  const containerClasses = [styles.searchContainer, className]
    .filter(Boolean)
    .join(' ');

  const showResultsCount = resultsCount !== undefined && totalCount !== undefined;

  return (
    <div className={containerClasses}>
      {/* Search input section */}
      <div className={styles.searchSection}>
        <div className={styles.inputWrapper}>
          <span className={styles.searchIcon} aria-hidden="true">
            <SearchIcon size={16} />
          </span>
          
          <input
            ref={inputRef}
            type="search"
            className={styles.searchInput}
            placeholder={placeholder}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-label="Filter components by name"
            aria-describedby={showResultsCount ? 'search-results-count' : undefined}
          />
          
          {value && (
            <button
              className={styles.clearButton}
              onClick={handleClear}
              type="button"
              aria-label="Clear search"
              title="Clear search (Esc)"
              tabIndex={-1}
            >
              <ClearIcon size={14} />
            </button>
          )}
        </div>

        {/* Results count */}
        {showResultsCount && (
          <span 
            id="search-results-count" 
            className={styles.resultsCount}
            aria-live="polite"
          >
            {resultsCount} / {totalCount}
          </span>
        )}
      </div>

      {/* Filter section */}
      <div className={styles.filtersSection}>
        <div className={styles.filterHeader}>
          <FilterIcon size={14} />
          <span className={styles.filterLabel}>Show:</span>
        </div>
        
        <div className={styles.severityButtons} role="group" aria-label="Filter by severity">
          <SeverityButton
            severity="critical"
            label="Critical"
            isActive={severityFilter.includes('critical')}
            onToggle={handleSeverityToggle}
            disabled={disabled}
          />
          <SeverityButton
            severity="warning"
            label="Warning"
            isActive={severityFilter.includes('warning')}
            onToggle={handleSeverityToggle}
            disabled={disabled}
          />
          <SeverityButton
            severity="info"
            label="Info"
            isActive={severityFilter.includes('info')}
            onToggle={handleSeverityToggle}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
});

TreeSearch.displayName = 'TreeSearch';

export default TreeSearch;
