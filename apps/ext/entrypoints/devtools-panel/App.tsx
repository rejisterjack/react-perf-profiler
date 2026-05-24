/**
 * DevTools Panel Root — connects to background, routes messages to stores, renders full UI.
 * Uses Web Worker for analysis, supports batch commits, score history, and render causes.
 */

import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useConnectionStore } from '@/src/panel/stores/connectionStore';
import { useBridgeStore } from '@/src/panel/stores/bridgeStore';
import { useProfilerStore, type ViewMode } from '@/src/panel/stores/profilerStore';
import { useNotificationStore } from '@/src/panel/stores/notificationStore';
import { PanelLayout } from '@/src/panel/components/layout/PanelLayout';
import { Toolbar } from '@/src/panel/components/layout/Toolbar';
import { WelcomeScreen } from '@/src/panel/components/layout/WelcomeScreen';
import { SettingsPanel } from '@/src/panel/components/layout/SettingsPanel';
import { TreeView } from '@/src/panel/components/tree/TreeView';
import { ErrorBoundary } from '@/src/panel/components/common/ErrorBoundary';
import Flamegraph from '@/src/panel/components/visualizations/Flamegraph';
import Timeline from '@/src/panel/components/visualizations/Timeline';
import { TimeTravelControls } from '@/src/panel/components/visualizations/TimeTravelControls';
import { AnalysisView } from '@/src/panel/components/analysis/AnalysisView';
import { ComponentDetails } from '@/src/panel/components/analysis/ComponentDetails';
import { ComparisonView } from '@/src/panel/components/analysis/ComparisonView';
import WebVitals from '@/src/panel/components/visualizations/WebVitals';
import { DependencyGraph } from '@/src/panel/components/visualizations/DependencyGraph';
import { AISuggestionsPanel } from '@/src/panel/components/analysis/AISuggestionsPanel';
import { runAnalysisAsync } from '@/src/panel/utils/analysisWorkerManager';
import { useSettingsStore } from '@/src/panel/stores/settingsStore';
import { useKeyboardShortcuts } from '@/src/panel/hooks/useKeyboardShortcuts';
import { useSessionPersistence } from '@/src/panel/hooks/useSessionPersistence';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { CommitData, WebVitalMetric, AnalysisResult, FiberData, ComponentMetrics } from '@/src/shared/types';

/** Compute ComponentMetrics for a specific component from commits */
function computeMetricsForComponent(
  componentName: string,
  commits: CommitData[],
): ComponentMetrics | null {
  const durations: number[] = [];
  let isMemoized = false;
  let firstSeen = Infinity;
  let lastSeen = 0;
  let wastedCount = 0;

  for (const commit of commits) {
    const fibers = commit.fibers ?? [];
    let found = false;
    for (const fiber of fibers) {
      if (fiber.displayName === componentName) {
        found = true;
        durations.push(fiber.actualDuration ?? 0);
        firstSeen = Math.min(firstSeen, commit.timestamp);
        lastSeen = Math.max(lastSeen, commit.timestamp);
        if (fiber.tag === 14 || fiber.tag === 15) isMemoized = true;
      }
    }
    if (!found) wastedCount++;
  }

  if (durations.length === 0) return null;

  const totalRenderTime = durations.reduce((a, b) => a + b, 0);
  return {
    componentName,
    renderCount: durations.length,
    wastedRenderCount: wastedCount,
    wastedRenderRate: durations.length > 0 ? Math.round((wastedCount / durations.length) * 1000) / 10 : 0,
    totalRenderTime,
    averageRenderTime: totalRenderTime / durations.length,
    maxRenderTime: Math.max(...durations),
    minRenderTime: Math.min(...durations),
    isMemoized,
    firstSeen,
    lastSeen,
  };
}

/**
 * Reconstruct a properly-linked FiberData[] from the flat format returned by
 * background.ts executeScript (where child/sibling/return are string IDs).
 */
function reconstructFiberTree(
  flat: Array<{ id: string; displayName: string | null; key: string | null; tag: number; actualDuration?: number; child: string | null; sibling: string | null; return: string | null }>,
): FiberData[] {
  if (!Array.isArray(flat) || flat.length === 0) return [];

  // Build id → FiberData map first
  const map = new Map<string, FiberData>();
  for (const f of flat) {
    map.set(f.id, {
      id: f.id,
      displayName: f.displayName ?? 'Unknown',
      key: f.key,
      tag: f.tag ?? 0,
      actualDuration: f.actualDuration ?? 0,
      actualStartTime: 0,
      selfBaseDuration: 0,
      treeBaseDuration: 0,
      index: 0,
      mode: 0,
      flags: 0,
      memoizedProps: {},
      memoizedState: undefined,
      child: null,
      sibling: null,
      return: null,
    } as FiberData);
  }

  // Wire up references
  for (const f of flat) {
    const node = map.get(f.id)!;
    if (f.child) node.child = map.get(f.child) ?? null;
    if (f.sibling) node.sibling = map.get(f.sibling) ?? null;
    if (f.return) node.return = map.get(f.return) ?? null;
  }

  return Array.from(map.values());
}

/** Empty state shown inside tabs that require recording data */
function NeedsRecordingState({ message, icon }: { message: string; icon?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground h-full">
      <div className="text-center space-y-3 px-8">
        <div className="text-3xl opacity-20">{icon ?? '⏺'}</div>
        <p className="text-sm font-medium">No data yet</p>
        <p className="text-xs leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

function App() {
  const connState = useConnectionStore((s) => s.state);
  const connect = useConnectionStore((s) => s.connect);
  const disconnect = useConnectionStore((s) => s.disconnect);

  // Live component tree (available without recording)
  const [liveFibers, setLiveFibers] = useState<FiberData[]>([]);

  // Settings panel open state
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { setBridgeState, setBridgeError, setReactDetected, setDevtoolsDetected, setReactVersion, setRetryCount } = useBridgeStore();
  const {
    addCommit, addCommitBatch, startRecording, stopRecording, addWebVitals,
    setAnalysisResults, setAnalysisProgress, setIsAnalyzing, setPerformanceScore,
    addScoreHistoryEntry, checkBudgets,
  } = useProfilerStore();
  const showNotif = useNotificationStore((s) => s.show);

  const isRecording = useProfilerStore((s) => s.isRecording);
  const commits = useProfilerStore((s) => s.commits);
  const viewMode = useProfilerStore((s) => s.viewMode);
  const selectedComponent = useProfilerStore((s) => s.selectedComponent);
  const filterText = useProfilerStore((s) => s.filterText);
  const isDetailPanelOpen = useProfilerStore((s) => s.isDetailPanelOpen);
  const selectedCommitId = useProfilerStore((s) => s.selectedCommitId);
  const analysisResults = useProfilerStore((s) => s.analysisResults);
  const wastedRenderReports = useProfilerStore((s) => s.wastedRenderReports);
  const performanceScore = useProfilerStore((s) => s.performanceScore);
  const webVitals = useProfilerStore((s) => s.webVitals);
  const budgetViolations = useProfilerStore((s) => s.budgetViolations);
  const setSelectedCommit = useProfilerStore((s) => s.setSelectedCommit);

  const setViewMode = useProfilerStore((s) => s.setViewMode);
  const selectComponent = useProfilerStore((s) => s.selectComponent);
  const setFilterText = useProfilerStore((s) => s.setFilterText);

  const analysisAbortRef = useRef(false);

  // Derived data
  const commitsArray = useMemo(() => commits.toArray(), [commits]);
  const lastCommit = commits.last();
  const fibers: FiberData[] = useMemo(() => {
    if (!selectedCommitId) return lastCommit?.fibers ?? [];
    const selected = commitsArray.find((c) => c.id === selectedCommitId);
    return selected?.fibers ?? lastCommit?.fibers ?? [];
  }, [selectedCommitId, commitsArray, lastCommit]);

  // Session persistence — auto-saves during recording, offers restore on mount
  const { hasSavedSession, savedSessionData, dismissSavedSession } = useSessionPersistence({
    onSessionFound: (data) => {
      showNotif('info', 'Session Found', `Previous session with ${data.commits.length} commits available`);
    },
  });

  // =========================================================================
  // Async analysis runner
  // =========================================================================

  const runAsyncAnalysis = useCallback(async (allCommits: CommitData[]) => {
    analysisAbortRef.current = false;
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    try {
      const results = await runAnalysisAsync(
        allCommits,
        (phase, progress) => {
          if (analysisAbortRef.current) return;
          setAnalysisProgress(progress);
        },
      );

      if (analysisAbortRef.current) return;

      setAnalysisResults(results);
      setPerformanceScore(results.performanceScore);
      setIsAnalyzing(false);

      // Send to APM if configured
      try {
        const settings = useSettingsStore.getState();
        if (settings.apmConfig.enabled && settings.apmConfig.sendOnAnalysis) {
          const { sendToAPM } = await import('@/src/panel/integrations');
          sendToAPM(results, settings.apmConfig).catch(() => {});
        }
      } catch { /* ignore */ }

      // Record score history
      addScoreHistoryEntry({
        timestamp: Date.now(),
        score: results.performanceScore,
        commitCount: allCommits.length,
        url: window.location.href,
        topIssue: results.topOpportunities[0]?.description,
      });

      // Check budgets
      const violations = checkBudgets();
      const budgetMsg = violations.length > 0
        ? ` — ${violations.length} budget violation(s)`
        : '';

      showNotif(
        'success',
        'Analysis Complete',
        `Score: ${results.performanceScore}/100 — ${results.wastedRenderReports.length} issues found${budgetMsg}`,
      );
    } catch (error) {
      if (analysisAbortRef.current) return;
      setIsAnalyzing(false);
      showNotif('error', 'Analysis Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [setAnalysisResults, setAnalysisProgress, setIsAnalyzing, setPerformanceScore, addScoreHistoryEntry, checkBudgets, showNotif]);

  // =========================================================================
  // Background message handler
  // =========================================================================

  const handleBackgroundMessage = useCallback((msg: { type: string; payload?: unknown }) => {
    switch (msg.type) {
      case 'COMMIT_DATA':
        addCommit(msg.payload as CommitData);
        break;
      case 'PROFILING_STARTED':
        startRecording();
        break;
      case 'PROFILING_STOPPED':
        stopRecording();
        break;
      case 'BRIDGE_INIT': {
        const p = (msg.payload ?? {}) as Record<string, unknown>;
        if (p.success) {
          setBridgeState('success');
          if (p.reactVersion) setReactVersion(p.reactVersion as string);
        }
        if (p.state === 'success') setBridgeState('success');
        else if (p.state === 'failed') setBridgeState('failed');
        if (typeof p.reactDetected === 'boolean') setReactDetected(p.reactDetected);
        break;
      }
      case 'BRIDGE_ERROR':
        setBridgeState('failed');
        setBridgeError({
          type: ((msg.payload as Record<string, unknown>)?.errorType as string) ?? 'UNKNOWN',
          message: ((msg.payload as Record<string, unknown>)?.errorDetails as string) ?? 'Unknown error',
          recoverable: ((msg.payload as Record<string, unknown>)?.recoverable as boolean) ?? false,
        });
        break;
      case 'BRIDGE_STATUS': {
        const p = (msg.payload ?? {}) as Record<string, unknown>;
        if (typeof p.reactDetected === 'boolean') setReactDetected(p.reactDetected);
        if (typeof p.devtoolsDetected === 'boolean') setDevtoolsDetected(p.devtoolsDetected);
        break;
      }
      case 'BRIDGE_RETRY_SCHEDULED': {
        const p = (msg.payload ?? {}) as Record<string, unknown>;
        setRetryCount((p.retryCount as number) ?? 0);
        break;
      }
      case 'REACT_DETECT_RESULT': {
        const p = (msg.payload ?? {}) as Record<string, unknown>;
        if (typeof p.reactDetected === 'boolean') setReactDetected(p.reactDetected);
        if (typeof p.devtoolsDetected === 'boolean') setDevtoolsDetected(p.devtoolsDetected);
        break;
      }
      case 'WEB_VITALS':
        addWebVitals((msg.payload as { metrics: WebVitalMetric[] }).metrics ?? []);
        break;
      case 'COMPONENT_TREE_RESULT': {
        const raw = msg.payload;
        if (Array.isArray(raw) && raw.length > 0) {
          // Check if it's the flat ID-ref format from background executeScript
          const first = raw[0] as Record<string, unknown>;
          if (typeof first.child === 'string' || first.child === null) {
            // Flat format — reconstruct linked tree
            setLiveFibers(reconstructFiberTree(raw as Parameters<typeof reconstructFiberTree>[0]));
          } else {
            // Already linked FiberData objects (from bridge via content script)
            setLiveFibers(raw as FiberData[]);
          }
        } else {
          setLiveFibers([]);
        }
        break;
      }
      case 'ANALYSIS_COMPLETE':
        setAnalysisResults(msg.payload as AnalysisResult);
        break;
      case 'ERROR':
        showNotif('error', 'Error', String((msg.payload as Record<string, unknown>)?.message ?? 'Unknown error'));
        break;
    }
  }, [addCommit, startRecording, stopRecording, addWebVitals, setAnalysisResults, setBridgeState, setBridgeError, setReactDetected, setDevtoolsDetected, setReactVersion, setRetryCount, showNotif]);

  // =========================================================================
  // Connect to background
  // =========================================================================

  const portRef = useRef<chrome.runtime.Port | null>(null);
  const handleMessageRef = useRef(handleBackgroundMessage);
  handleMessageRef.current = handleBackgroundMessage;

  useEffect(() => {
    connect();
    try {
      let tabId = 'unknown';
      try { tabId = String(chrome.devtools.inspectedWindow.tabId); } catch { /* not in devtools */ }
      const port = chrome.runtime.connect({ name: `react-perf-profiler-panel-${tabId}` });
      port.onMessage.addListener((msg: { type: string; payload?: unknown }) => handleMessageRef.current(msg));
      port.onDisconnect.addListener(() => disconnect());
      portRef.current = port;
      useConnectionStore.setState({ state: 'connected' });
    } catch {
      disconnect();
    }
    return () => {
      if (portRef.current) { try { portRef.current.disconnect(); } catch { /* ignore */ } portRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================================================================
  // Fetch live component tree (no recording needed)
  // =========================================================================

  useEffect(() => {
    if (connState !== 'connected' || isRecording) return;
    const fetchTree = () => {
      try {
        if (portRef.current) portRef.current.postMessage({ type: 'GET_COMPONENT_TREE' });
      } catch { /* ignore */ }
    };
    fetchTree();
    const interval = setInterval(fetchTree, 3000);
    return () => clearInterval(interval);
  }, [connState, isRecording]);

  // =========================================================================
  // Keyboard shortcuts
  // =========================================================================

  useKeyboardShortcuts({
    onToggleRecording: handleToggleRecording,
    onExport: () => {
      const data = commits.toArray();
      if (data.length > 0) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `react-perf-profile-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    onSwitchView: setViewMode,
    onDeselectComponent: () => selectComponent(null),
    onFocusSearch: () => setFilterText(''),
  });

  // =========================================================================
  // Profiling controls
  // =========================================================================

  function handleToggleRecording() {
    try {
      if (isRecording) {
        // Optimistically stop recording
        stopRecording();
        portRef.current?.postMessage({ type: 'STOP_PROFILING' });
        const allCommits = commits.toArray();
        if (allCommits.length > 0) {
          runAsyncAnalysis(allCommits);
        }
      } else {
        // Optimistically start recording
        startRecording();
        portRef.current?.postMessage({ type: 'START_PROFILING' });
      }
    } catch { /* ignore */ }
  }

  const handleSelectCommit = useCallback((id: string) => {
    setSelectedCommit(id);
  }, [setSelectedCommit]);

  // =========================================================================
  // Render
  // =========================================================================

  const hasData = commits.size > 0;
  // Show tree with live fibers when not recording, or commit fibers when recording
  const treeFibers = hasData ? fibers : liveFibers;
  const hasLiveTree = liveFibers.length > 0;

  return (
    <ErrorBoundary>
      <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
        <Toolbar
          isRecording={isRecording}
          onToggleRecording={handleToggleRecording}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          connectionState={connState}
          wastedRenderCount={wastedRenderReports.length}
          criticalCount={wastedRenderReports.filter((r) => r.severity === 'critical' || r.severity === 'high').length}
          performanceScore={performanceScore}
          budgetViolations={budgetViolations.length}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <PanelLayout
          sidebar={
            <TreeView
              fibers={treeFibers}
              selectedComponent={selectedComponent}
              onSelectComponent={selectComponent}
              filterText={filterText}
              wastedRenderReports={wastedRenderReports}
            />
          }
          detailPanel={
            isDetailPanelOpen && selectedComponent ? (
              <Tabs defaultValue="details" className="flex flex-col h-full">
                <div className="shrink-0 border-b border-border px-2">
                  <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="ai">AI Fix</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="details" className="flex-1 overflow-y-auto">
                  <ComponentDetails
                    componentName={selectedComponent}
                    commits={commitsArray}
                  />
                </TabsContent>
                <TabsContent value="ai" className="flex-1 overflow-y-auto">
                  {(() => {
                    const metrics = computeMetricsForComponent(selectedComponent, commitsArray);
                    if (!metrics) {
                      return (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                          <p className="text-sm">No metrics for {selectedComponent}</p>
                        </div>
                      );
                    }
                    return (
                      <AISuggestionsPanel
                        componentName={selectedComponent}
                        metrics={metrics}
                        commits={commitsArray}
                      />
                    );
                  })()}
                </TabsContent>
              </Tabs>
            ) : undefined
          }
        >
          {/* TREE VIEW — show welcome if no data/tree, or recording state if active */}
          {viewMode === 'tree' && (
            hasLiveTree || hasData ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2 px-8">
                  <div className="text-2xl opacity-20">🌳</div>
                  <p className="text-sm font-medium">
                    {treeFibers.length} component{treeFibers.length !== 1 ? 's' : ''} in tree
                  </p>
                  <p className="text-xs">
                    {hasData
                      ? 'Select a component in the sidebar to inspect it'
                      : 'Click Record to capture render performance data'}
                  </p>
                </div>
              </div>
            ) : isRecording ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-3 px-8">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse mx-auto" />
                  <p className="text-sm font-medium">Recording in progress…</p>
                  <p className="text-xs">Interact with the page to capture React commits, then click Stop</p>
                </div>
              </div>
            ) : (
              <WelcomeScreen onStartRecording={handleToggleRecording} />
            )
          )}

          {/* FLAMEGRAPH — needs recording data */}
          {viewMode === 'flamegraph' && (
            hasData ? (
              <Flamegraph
                fibers={fibers}
                selectedComponent={selectedComponent}
                onSelectComponent={selectComponent}
              />
            ) : (
              <NeedsRecordingState
                icon="🔥"
                message="Click Record to start capturing React commits. The flamegraph visualizes component render durations."
              />
            )
          )}

          {/* TIMELINE — needs recording data */}
          {viewMode === 'timeline' && (
            hasData ? (
              <div className="flex flex-col flex-1 h-full">
                <TimeTravelControls />
                <Timeline
                  commits={commitsArray}
                  selectedCommitId={selectedCommitId}
                  onSelectCommit={handleSelectCommit}
                />
              </div>
            ) : (
              <NeedsRecordingState
                icon="⏱"
                message="Click Record to start capturing React commits. The timeline shows when each commit occurred and how long it took."
              />
            )
          )}

          {/* ANALYSIS — shows empty state or results */}
          {viewMode === 'analysis' && (
            <div className="flex flex-col flex-1 h-full overflow-hidden">
              <AnalysisView
                analysisResults={analysisResults}
                commits={commitsArray}
              />
            </div>
          )}

          {/* WEB VITALS — collected passively, no recording required */}
          {viewMode === 'vitals' && (
            <div className="flex-1 overflow-y-auto h-full">
              {webVitals.length > 0 ? (
                <WebVitals metrics={webVitals} />
              ) : (
                <NeedsRecordingState
                  icon="📊"
                  message="Web Vitals (LCP, FID, CLS, INP) are collected automatically. Navigate the inspected page to capture metrics."
                />
              )}
            </div>
          )}

          {/* COMPARE — works with or without data */}
          {viewMode === 'compare' && (
            <div className="flex-1 overflow-y-auto h-full">
              <ComparisonView />
            </div>
          )}

          {/* DEPENDENCIES — needs render cause data from recording */}
          {viewMode === 'dependencies' && (
            <div className="flex-1 overflow-y-auto h-full">
              {hasData ? (
                <DependencyGraph />
              ) : (
                <NeedsRecordingState
                  icon="🔗"
                  message="Click Record to start capturing React commits. The dependency graph shows which components cause others to re-render."
                />
              )}
            </div>
          )}
        </PanelLayout>

        <ToastContainer />
      </div>

      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
    </ErrorBoundary>
  );
}

function ToastContainer() {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismiss = useNotificationStore((s) => s.dismiss);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-3 right-3 z-50 flex flex-col gap-2 max-w-xs">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={cn(
            'flex items-start gap-2 rounded-md border px-3 py-2 shadow-lg text-xs animate-fade-slide-up',
            n.type === 'success' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
            n.type === 'error' && 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400',
            n.type === 'warning' && 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400',
            n.type === 'info' && 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400',
          )}
          onClick={() => dismiss(n.id)}
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium">{n.title}</p>
            <p className="text-[10px] opacity-80 truncate">{n.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default App;
