/**
 * ProfileCompare
 * Lets the user pin the current session as a "baseline" and then see
 * per-component deltas after further profiling.
 */

import type React from 'react';
import { useState, useMemo } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { compareProfiles, type ProfileComparisonResult } from '@/panel/utils/profileComparison';
import type { CommitData } from '@/content/types';
import { Icon } from '../Common/Icon/Icon';
import { Button } from '../Common/Button/Button';
import styles from './ProfileCompare.module.css';

// ============================================================================
// Delta badge
// ============================================================================

const DeltaBadge: React.FC<{ value: number; pct: number | null; unit?: string }> = ({
  value,
  pct,
  unit = 'ms',
}) => {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  const formatted = `${isPositive ? '+' : ''}${value.toFixed(2)}${unit}`;
  const pctText = pct !== null ? ` (${isPositive ? '+' : ''}${pct.toFixed(1)}%)` : '';

  return (
    <span
      className={`${styles['delta']} ${isNeutral ? styles['neutral'] : isPositive ? styles['worse'] : styles['better']}`}
      role="status"
      aria-label={`Change: ${formatted}${pctText}`}
    >
      {!isNeutral && <Icon name={isPositive ? 'arrowUp' : 'arrowDown'} size={10} />}
      {formatted}
      {pctText}
    </span>
  );
};

// ============================================================================
// Main component
// ============================================================================

export const ProfileCompare: React.FC = () => {
  const { commits } = useProfilerStore();
  const [baseline, setBaseline] = useState<CommitData[] | null>(null);
  const [baselineLabel, setBaselineLabel] = useState('');
  const [result, setResult] = useState<ProfileComparisonResult | null>(null);
  const [filter, setFilter] = useState('');

  const pinBaseline = () => {
    setBaseline([...commits]);
    setBaselineLabel(new Date().toLocaleTimeString());
    setResult(null);
  };

  const runComparison = () => {
    if (!baseline) return;
    setResult(compareProfiles(baseline, commits, `Baseline (${baselineLabel})`, 'Current'));
  };

  const clearBaseline = () => {
    setBaseline(null);
    setResult(null);
    setFilter('');
  };

  const filteredComponents = useMemo(() => {
    if (!result) return [];
    const q = filter.toLowerCase();
    return q ? result.components.filter((c) => c.name.toLowerCase().includes(q)) : result.components;
  }, [result, filter]);

  if (commits.length === 0) {
    return (
      <div className={styles['empty']} role="status">
        <Icon name="analysis" size={32} />
        <p>Record a session first, then pin it as a baseline to compare with future recordings.</p>
      </div>
    );
  }

  return (
    <div className={styles['container']}>
      {/* Controls */}
      <section className={styles['controls']}>
        {!baseline ? (
          <Button variant="primary" size="sm" icon="bookmark" iconPosition="left" onClick={pinBaseline}>
            Pin current as baseline ({commits.length} commits)
          </Button>
        ) : (
          <>
            <span className={styles['baselineInfo']}>
              <Icon name="bookmark" size={14} />
              Baseline: {baselineLabel} — {baseline.length} commits
            </span>
            <Button variant="secondary" size="sm" onClick={runComparison} icon="analysis" iconPosition="left">
              Compare with current ({commits.length} commits)
            </Button>
            <Button variant="ghost" size="sm" onClick={clearBaseline}>
              Clear baseline
            </Button>
          </>
        )}
      </section>

      {/* Results */}
      {result && (
        <div className={styles['results']}>
          {/* Summary row */}
          <section className={styles['summary']} aria-label="Comparison summary">
            <div className={styles['summaryItem']}>
              <span className={styles['summaryLabel']}>Total renders</span>
              <DeltaBadge value={result.totalRenderCountDelta} pct={null} unit="" />
            </div>
            <div className={styles['summaryItem']}>
              <span className={styles['summaryLabel']}>Wasted renders</span>
              <DeltaBadge value={result.totalWastedRendersDelta} pct={null} unit="" />
            </div>
            <div className={styles['summaryItem']}>
              <span className={styles['summaryLabel']}>Components</span>
              <span className={styles['summaryValue']}>{result.components.length}</span>
            </div>
          </section>

          {/* Filter */}
          <input
            className={styles['filterInput']}
            type="search"
            placeholder="Filter components…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter comparison results by component name"
          />

          {/* Table */}
          <section className={styles['tableWrapper']} aria-label="Per-component comparison">
            <table className={styles['table']}>
              <thead>
                <tr>
                  <th scope="col">Component</th>
                  <th scope="col">Renders Δ</th>
                  <th scope="col">Avg Duration Δ</th>
                  <th scope="col">Wasted Renders Δ</th>
                </tr>
              </thead>
              <tbody>
                {filteredComponents.map((d) => (
                  <tr
                    key={d.name}
                    className={`${d.isNew ? styles['rowNew'] : ''} ${d.isRemoved ? styles['rowRemoved'] : ''}`}
                  >
                    <td className={styles['componentName']}>
                      {d.isNew && <span className={styles['badge']} role="status" aria-label="New component">NEW</span>}
                      {d.isRemoved && <span className={styles['badge']} role="status" aria-label="Removed component">GONE</span>}
                      {d.name}
                    </td>
                    <td>
                      <DeltaBadge value={d.renderCountDelta} pct={d.renderCountDeltaPct} unit="" />
                    </td>
                    <td>
                      <DeltaBadge value={d.avgDurationDelta} pct={d.avgDurationDeltaPct} />
                    </td>
                    <td>
                      <DeltaBadge value={d.wastedRendersDelta} pct={null} unit="" />
                    </td>
                  </tr>
                ))}
                {filteredComponents.length === 0 && (
                  <tr>
                    <td colSpan={4} className={styles['noResults']}>
                      No components match the filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
};

export default ProfileCompare;
