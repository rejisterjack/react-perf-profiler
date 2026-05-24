/**
 * Memoized selectors for derived profiler state
 */

import { createSelector } from 'reselect';
import type { CommitData, ComponentMetrics } from '@/src/shared/types';
import type { ProfilerState } from './profilerStore';

// Input selectors
const selectCommitsArray = (state: ProfilerState) => state.commits.toArray();
const selectSelectedCommitId = (state: ProfilerState) => state.selectedCommitId;
const selectFilterText = (state: ProfilerState) => state.filterText;
const selectComponentMetrics = (state: ProfilerState) => state.componentMetrics;
const selectSelectedComponent = (state: ProfilerState) => state.selectedComponent;

// Derived selectors
export const selectCommitCount = createSelector(
  [selectCommitsArray],
  (commits) => commits.length,
);

export const selectLastCommit = createSelector(
  [selectCommitsArray],
  (commits) => commits[commits.length - 1] ?? null,
);

export const selectSelectedCommit = createSelector(
  [selectCommitsArray, selectSelectedCommitId],
  (commits, id) => (id ? commits.find((c) => c.id === id) ?? null : null),
);

export const selectFilteredMetrics = createSelector(
  [selectComponentMetrics, selectFilterText],
  (metrics, filter): ComponentMetrics[] => {
    const arr = Array.from(metrics.values());
    if (!filter) return arr;
    const lower = filter.toLowerCase();
    return arr.filter((m) => m.componentName.toLowerCase().includes(lower));
  },
);

export const selectSelectedComponentMetrics = createSelector(
  [selectComponentMetrics, selectSelectedComponent],
  (metrics, name) => (name ? metrics.get(name) ?? null : null),
);

export const selectTotalWastedRenders = createSelector(
  [(state: ProfilerState) => state.wastedRenderReports],
  (reports) => reports.reduce((sum, r) => sum + r.wastedRenders, 0),
);

export const selectAverageRenderTime = createSelector(
  [selectCommitsArray],
  (commits) => {
    if (commits.length === 0) return 0;
    return commits.reduce((sum, c) => sum + c.duration, 0) / commits.length;
  },
);
