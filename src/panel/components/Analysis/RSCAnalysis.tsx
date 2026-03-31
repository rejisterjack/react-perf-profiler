/**
 * RSC Analysis Component
 * Displays React Server Components analysis results
 * @module panel/components/Analysis
 */

import type React from 'react';
import type {
  RSCAnalysisResult,
  RSCMetrics,
  RSCBoundaryMetrics,
  RSCIssue,
  RSCRecommendation,
  RSCIssueSeverity,
  ComponentType,
  RSCRecommendationPriority,
} from '@/shared/types/rsc';
import { checkRSCSupport } from '@/panel/utils/rscVersionDetect';
import { Badge } from '../Common/Badge/Badge';
import { Icon } from '../Common/Icon/Icon';
import { ErrorBoundary } from '../ErrorBoundary';
import styles from './RSCAnalysis.module.css';

/* ============================================================================
   Main Component
   ============================================================================ */

export interface RSCAnalysisProps {
  /** RSC analysis result data */
  analysis: RSCAnalysisResult | null;
  /** Loading state */
  loading: boolean;
  /** React version detected from the profiled page, used for graceful degradation */
  reactVersion?: string;
}

/**
 * Main RSC Analysis component
 * Displays comprehensive RSC analysis results including metrics, boundaries,
 * streaming timeline, issues, and recommendations.
 */
export const RSCAnalysis: React.FC<RSCAnalysisProps> = ({ analysis, loading, reactVersion }) => {
  if (loading) {
    return (
      <div className={styles['loading']}>
        <div className={styles['spinner']} />
        <p>Analyzing RSC performance...</p>
      </div>
    );
  }

  if (!analysis) {
    const support = checkRSCSupport(reactVersion);
    return (
      <div className={styles['empty']}>
        <Icon name="info" size={32} />
        {support.supported ? (
          <>
            <p>No RSC analysis data available.</p>
            <small>Record a profile with RSC activity to see analysis.</small>
          </>
        ) : (
          <>
            <p>React Server Components not available.</p>
            <small>{support.reason}</small>
          </>
        )}
      </div>
    );
  }

  return (
    <ErrorBoundary context="RSC Analysis" compact>
    <div className={styles['rscAnalysis']}>
      {/* Summary Header }*/}
      <div className={styles['summaryHeader']}>
        <div className={styles['summaryTitle']}>
          <h2>
            <Icon name="analysis" size={20} />
            RSC Analysis
          </h2>
          <span className={styles['timestamp']}>
            {new Date(analysis.timestamp).toLocaleString()}
          </span>
        </div>
        <div className={styles['scoreBadge']}>
          <span className={styles['scoreLabel']}>Score</span>
          <span className={`${styles['scoreValue']} ${getScoreClass(analysis.performanceScore)}`}>
            {analysis.performanceScore}
          </span>
        </div>
      </div>

      {/* Metrics Overview */}
      <RSCMetricsCard metrics={analysis.metrics} />

      {/* Issues Summary */}
      <div className={styles['issuesSummary']}>
        <div className={styles['issueCount']}>
          <Icon name="error" size={14} />
          <span>{analysis.summary.criticalIssues}</span>
          <small>Critical</small>
        </div>
        <div className={styles['issueCount']}>
          <Icon name="warning" size={14} />
          <span>{analysis.summary.highIssues}</span>
          <small>High</small>
        </div>
        <div className={styles['issueCount']}>
          <Icon name="info" size={14} />
          <span>{analysis.summary.mediumIssues}</span>
          <small>Medium</small>
        </div>
        <div className={styles['issueCount']}>
          <span className={styles['lowCount']}>{analysis.summary.lowIssues}</span>
          <small>Low</small>
        </div>
      </div>

      {/* Content Grid */}
      <div className={styles['contentGrid']}>
        <div className={styles['leftColumn']}>
          <RSCStreamTimeline chunks={analysis.metrics.streamMetrics} />
          <RSCBoundariesTable
            boundaries={analysis.metrics.boundaryMetrics}
            totalServerCount={analysis.metrics.serverComponentCount}
            totalClientCount={analysis.metrics.clientComponentCount}
          />
        </div>
        <div className={styles['rightColumn']}>
          <RSCIssuesList issues={analysis.issues} />
          <RSCRecommendationsPanel recommendations={analysis.recommendations} />
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
};

function getScoreClass(score: number): string {
  if (score >= 80) return styles['scoreGood'] ?? '';
  if (score >= 60) return styles['scoreWarning'] ?? '';
  return styles['scoreBad'] ?? '';
}

/* ============================================================================
   Section Components
   ============================================================================ */

interface RSCMetricsCardProps {
  /** RSC metrics data */
  metrics: RSCMetrics;
}

/**
 * Displays payload metrics including size, transfer time, and serialization cost
 */
export const RSCMetricsCard: React.FC<RSCMetricsCardProps> = ({ metrics }) => {
  const cacheHitRate = Math.round(metrics.cacheHitRatio * 100);
  const slowestBoundary = metrics.boundaryMetrics.reduce(
    (slowest, b) => (b.renderTime > slowest.renderTime ? b : slowest),
    metrics.boundaryMetrics[0] ?? { renderTime: 0, componentName: '-' }
  );

  return (
    <div className={styles['metricsCard']}>
      <div className={styles['metricSection']}>
        <h4>Payload</h4>
        <div className={styles['metricsGrid']}>
          <div className={styles['metric']}>
            <span className={styles['metricValue']}>{formatBytes(metrics.payloadSize)}</span>
            <PayloadSizeBar size={metrics.payloadSize} />
            <span className={styles['metricLabel']}>Total Size</span>
          </div>
          <div className={styles['metric']}>
            <span className={styles['metricValue']}>{formatDuration(metrics.transferTime)}</span>
            <span className={styles['metricLabel']}>Transfer Time</span>
          </div>
          <div className={styles['metric']}>
            <span className={styles['metricValue']}>{formatDuration(metrics.serializationCost)}</span>
            <span className={styles['metricLabel']}>Serialization</span>
          </div>
          <div className={styles['metric']}>
            <span className={styles['metricValue']}>{formatDuration(metrics.deserializationCost)}</span>
            <span className={styles['metricLabel']}>Deserialization</span>
          </div>
        </div>
      </div>

      <div className={styles['metricDivider']} />

      <div className={styles['metricSection']}>
        <h4>Components</h4>
        <div className={styles['metricsGrid']}>
          <div className={styles['metric']}>
            <span className={`${styles['metricValue']} ${styles['serverValue']}`}>
              {metrics.serverComponentCount}
            </span>
            <span className={styles['metricLabel']}>Server</span>
          </div>
          <div className={styles['metric']}>
            <span className={`${styles['metricValue']} ${styles['clientValue']}`}>
              {metrics.clientComponentCount}
            </span>
            <span className={styles['metricLabel']}>Client</span>
          </div>
          <div className={styles['metric']}>
            <span className={styles['metricValue']}>{metrics.boundaryCount}</span>
            <span className={styles['metricLabel']}>Boundaries</span>
          </div>
          <div className={styles['metric']}>
            <span className={`${styles['metricValue']} ${getCacheClass(cacheHitRate)}`}>
              {cacheHitRate}%
            </span>
            <span className={styles['metricLabel']}>Cache Hit Rate</span>
          </div>
        </div>
      </div>

      <div className={styles['metricDivider']} />

      <div className={styles['metricSection']}>
        <h4>Performance</h4>
        <div className={styles['metricsGrid']}>
          <div className={styles['metric']}>
            <span className={styles['metricValue']}>{slowestBoundary.componentName}</span>
            <span className={styles['metricLabel']}>Slowest Boundary ({slowestBoundary.renderTime.toFixed(1)}ms)</span>
          </div>
          <div className={styles['metric']}>
            <span className={styles['metricValue']}>
              {formatDuration(metrics.streamMetrics.timeToFirstChunk)}
            </span>
            <span className={styles['metricLabel']}>Time to First Chunk</span>
          </div>
        </div>
      </div>
    </div>
  );
};

function getCacheClass(rate: number): string {
  if (rate >= 80) return styles['cacheGood'] ?? '';
  if (rate >= 60) return styles['cacheWarning'] ?? '';
  return styles['cacheBad'] ?? '';
}

interface RSCBoundariesTableProps {
  /** List of boundary metrics */
  boundaries: RSCBoundaryMetrics[];
  /** Total server component count */
  totalServerCount: number;
  /** Total client component count */
  totalClientCount: number;
}

/**
 * Table of all server/client boundaries with stats
 */
export const RSCBoundariesTable: React.FC<RSCBoundariesTableProps> = ({
  boundaries,
  totalServerCount,
  totalClientCount,
}) => {
  if (boundaries.length === 0) {
    return (
      <div className={styles['boundariesPanel']}>
        <h3>
          <Icon name="component" size={16} />
          Boundaries
        </h3>
        <p className={styles['emptyText']}>No boundary data available.</p>
      </div>
    );
  }

  // Sort by render time descending
  const sortedBoundaries = [...boundaries].sort((a, b) => b.renderTime - a.renderTime);

  return (
    <div className={styles['boundariesPanel']}>
      <div className={styles['boundariesHeader']}>
        <h3>
          <Icon name="component" size={16} />
          Boundaries
        </h3>
        <div className={styles['boundaryCounts']}>
          <Badge variant="primary" size="sm">
            {totalServerCount} Server
          </Badge>
          <Badge variant="secondary" size="sm">
            {totalClientCount} Client
          </Badge>
        </div>
      </div>

      <div className={styles['boundariesTable']}>
        <table>
          <thead>
            <tr>
              <th>Component</th>
              <th>Type</th>
              <th>Cache</th>
              <th className={styles['numeric']}>Render Time</th>
              <th className={styles['numeric']}>Payload</th>
            </tr>
          </thead>
          <tbody>
            {sortedBoundaries.map((boundary) => (
              <tr key={boundary.boundaryId}>
                <td className={styles['componentCell']}>
                  <code>{boundary.componentName}</code>
                </td>
                <td>
                  <BoundaryTypeBadge type={getComponentType(boundary)} />
                </td>
                <td>
                  <CacheStatusIndicator status={boundary.cacheStatus} />
                </td>
                <td className={styles['numeric']}>{boundary.renderTime.toFixed(1)}ms</td>
                <td className={styles['numeric']}>{formatBytes(boundary.payloadSize)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function getComponentType(boundary: RSCBoundaryMetrics): ComponentType {
  // Infer type based on cache status and render behavior
  if (boundary.cacheStatus === 'hit' || boundary.cacheStatus === 'miss') {
    return 'server';
  }
  if (boundary.causedCacheMiss) {
    return 'client';
  }
  return 'shared';
}

interface RSCStreamTimelineProps {
  /** Stream metrics with chunk information */
  chunks: {
    chunkCount: number;
    averageChunkSize: number;
    maxChunkSize: number;
    minChunkSize: number;
    boundaryChunks: number;
    interleavedChunks: number;
    timeToFirstChunk: number;
    streamDuration: number;
    suspenseResolutions: number;
    hadOutOfOrderChunks: boolean;
  };
}

/**
 * Visual timeline of RSC streaming chunks
 */
export const RSCStreamTimeline: React.FC<RSCStreamTimelineProps> = ({ chunks }) => {
  return (
    <div className={styles['streamPanel']}>
      <div className={styles['streamHeader']}>
        <h3>
          <Icon name="timeline" size={16} />
          Streaming Timeline
        </h3>
        <StreamingProgress
          chunkCount={chunks.chunkCount}
          streamDuration={chunks.streamDuration}
        />
      </div>

      <div className={styles['streamMetrics']}>
        <div className={styles['streamMetric']}>
          <span className={styles['streamValue']}>{chunks.chunkCount}</span>
          <span className={styles['streamLabel']}>Chunks</span>
        </div>
        <div className={styles['streamMetric']}>
          <span className={styles['streamValue']}>{formatBytes(chunks.averageChunkSize)}</span>
          <span className={styles['streamLabel']}>Avg Size</span>
        </div>
        <div className={styles['streamMetric']}>
          <span className={styles['streamValue']}>{formatBytes(chunks.maxChunkSize)}</span>
          <span className={styles['streamLabel']}>Max Size</span>
        </div>
        <div className={styles['streamMetric']}>
          <span className={styles['streamValue']}>{chunks.boundaryChunks}</span>
          <span className={styles['streamLabel']}>With Boundaries</span>
        </div>
        <div className={styles['streamMetric']}>
          <span className={styles['streamValue']}>{chunks.suspenseResolutions}</span>
          <span className={styles['streamLabel']}>Suspense Resolved</span>
        </div>
        {chunks.hadOutOfOrderChunks && (
          <div className={`${styles['streamMetric']} ${styles['warning']}`}>
            <Icon name="warning" size={14} />
            <span className={styles['streamLabel']}>Out of Order</span>
          </div>
        )}
      </div>

      {/* Visual timeline bar */}
      <div className={styles['timelineBar']}>
        <div className={styles['timelineTrack']}>
          <div
            className={styles['timelineProgress']}
            style={{
              width: `${Math.min(100, (chunks.timeToFirstChunk / Math.max(chunks.streamDuration, 1)) * 100)}%`,
            }}
          />
          <div
            className={styles['timelineChunk']}
            style={{
              left: `${Math.min(100, (chunks.timeToFirstChunk / Math.max(chunks.streamDuration, 1)) * 100)}%`,
            }}
          />
        </div>
        <div className={styles['timelineLabels']}>
          <span>0ms</span>
          <span>TTFB: {formatDuration(chunks.timeToFirstChunk)}</span>
          <span>{formatDuration(chunks.streamDuration)}</span>
        </div>
      </div>
    </div>
  );
};

interface RSCIssuesListProps {
  /** List of detected issues */
  issues: RSCIssue[];
}

/**
 * List of detected issues with severity badges
 */
export const RSCIssuesList: React.FC<RSCIssuesListProps> = ({ issues }) => {
  if (issues.length === 0) {
    return (
      <div className={styles['issuesPanel']}>
        <h3>
          <Icon name="check" size={16} />
          Issues
        </h3>
        <div className={styles['allGood']}>
          <Icon name="success" size={32} />
          <p>No issues detected!</p>
          <small>Your RSC implementation looks good.</small>
        </div>
      </div>
    );
  }

  // Sort by severity
  const severityOrder: Record<RSCIssueSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const sortedIssues = [...issues].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const getSeverityVariant = (severity: RSCIssueSeverity) => {
    switch (severity) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  const getIssueIcon = (severity: RSCIssueSeverity): IconName => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'info';
    }
  };

  return (
    <div className={styles['issuesPanel']}>
      <h3>
        <Icon name="warning" size={16} />
        Issues
        <span className={styles['issueTotal']}>({issues.length})</span>
      </h3>
      <ul className={styles['issuesList']}>
        {sortedIssues.map((issue) => (
          <li key={issue.id} className={styles['issue']}>
            <div className={styles['issueHeader']}>
              <Icon name={getIssueIcon(issue.severity)} size={14} />
              <code className={styles['issueComponent']}>{issue.componentName}</code>
              <Badge variant={getSeverityVariant(issue.severity)} size="sm">
                {issue.severity}
              </Badge>
            </div>
            <p className={styles['issueDescription']}>{issue.description}</p>
            <p className={styles['issueSuggestion']}>{issue.suggestion}</p>
            {issue.metricValue !== undefined && issue.threshold !== undefined && (
              <div className={styles['issueMetric']}>
                <span>{issue.metricValue.toFixed(1)}</span>
                <span className={styles['threshold']}>/ {issue.threshold}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

interface RSCRecommendationsPanelProps {
  /** List of optimization recommendations */
  recommendations: RSCRecommendation[];
}

/**
 * Optimization recommendations panel
 */
export const RSCRecommendationsPanel: React.FC<RSCRecommendationsPanelProps> = ({
  recommendations,
}) => {
  if (recommendations.length === 0) {
    return (
      <div className={styles['recommendationsPanel']}>
        <h3>
          <Icon name="lightbulb" size={16} />
          Recommendations
        </h3>
        <p className={styles['emptyText']}>No recommendations at this time.</p>
      </div>
    );
  }

  // Sort by priority
  const priorityOrder: Record<RSCRecommendationPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const sortedRecommendations = [...recommendations].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  const getPriorityVariant = (priority: RSCRecommendationPriority) => {
    switch (priority) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <div className={styles['recommendationsPanel']}>
      <h3>
        <Icon name="lightbulb" size={16} />
        Recommendations
        <span className={styles['recommendationTotal']}>({recommendations.length})</span>
      </h3>
      <ul className={styles['recommendationsList']}>
        {sortedRecommendations.map((rec) => (
          <li key={rec.id} className={styles['recommendation']}>
            <div className={styles['recommendationHeader']}>
              <Badge variant={getPriorityVariant(rec.priority)} size="sm">
                {rec.priority}
              </Badge>
              <span className={styles['recommendationType']}>{formatType(rec.type)}</span>
            </div>
            <p className={styles['recommendationDescription']}>{rec.description}</p>
            <div className={styles['recommendationImpact']}>
              {rec.expectedImpact.timeSavings > 0 && (
                <span className={styles['impactItem']}>
                  <Icon name="time" size={12} />
                  -{rec.expectedImpact.timeSavings.toFixed(0)}ms
                </span>
              )}
              {rec.expectedImpact.sizeReduction > 0 && (
                <span className={styles['impactItem']}>
                  <Icon name="download" size={12} />
                  -{formatBytes(rec.expectedImpact.sizeReduction)}
                </span>
              )}
              {rec.expectedImpact.cacheHitImprovement > 0 && (
                <span className={styles['impactItem']}>
                  <Icon name="refresh" size={12} />
                  +{Math.round(rec.expectedImpact.cacheHitImprovement * 100)}%
                </span>
              )}
            </div>
            {rec.affectedComponents.length > 0 && (
              <div className={styles['affectedComponents']}>
                <small>Affects:</small>
                <div className={styles['componentTags']}>
                  {rec.affectedComponents.slice(0, 3).map((comp) => (
                    <code key={comp} className={styles['componentTag']}>
                      {comp}
                    </code>
                  ))}
                  {rec.affectedComponents.length > 3 && (
                    <span className={styles['moreTag']}>
                      +{rec.affectedComponents.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}
            {rec.codeExample && (
              <details className={styles['codeExample']}>
                <summary>Example</summary>
                <pre>
                  <code>{rec.codeExample}</code>
                </pre>
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

function formatType(type: string): string {
  return type
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/* ============================================================================
   Helper Components
   ============================================================================ */

interface BoundaryTypeBadgeProps {
  /** Component type: 'server' | 'client' | 'shared' */
  type: ComponentType;
}

/**
 * Shows component type with appropriate colors
 */
export const BoundaryTypeBadge: React.FC<BoundaryTypeBadgeProps> = ({ type }) => {
  const variant = type === 'server' ? 'primary' : type === 'client' ? 'secondary' : 'warning';
  return (
    <Badge variant={variant} size="sm">
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </Badge>
  );
};

interface CacheStatusIndicatorProps {
  /** Cache status: 'hit' | 'miss' | 'stale' | 'none' */
  status: 'hit' | 'miss' | 'stale' | 'none';
}

/**
 * Shows cache hit/miss/pending status
 */
export const CacheStatusIndicator: React.FC<CacheStatusIndicatorProps> = ({ status }) => {
  const getIcon = (): IconName => {
    switch (status) {
      case 'hit':
        return 'check';
      case 'miss':
        return 'error';
      case 'stale':
        return 'warning';
      case 'none':
        return 'dot';
      default:
        return 'dot';
    }
  };

  const getClass = (): string => {
    switch (status) {
      case 'hit':
        return styles['cacheHit'] ?? '';
      case 'miss':
        return styles['cacheMiss'] ?? '';
      case 'stale':
        return styles['cacheStale'] ?? '';
      case 'none':
        return styles['cacheNone'] ?? '';
      default:
        return '';
    }
  };

  return (
    <span className={`${styles['cacheIndicator']} ${getClass()}`}>
      <Icon name={getIcon()} size={12} />
      <span>{status}</span>
    </span>
  );
};

interface PayloadSizeBarProps {
  /** Payload size in bytes */
  size: number;
}

/**
 * Visual bar showing payload size with warning colors
 */
export const PayloadSizeBar: React.FC<PayloadSizeBarProps> = ({ size }) => {
  // Thresholds: 100KB = warning, 500KB = error
  const THRESHOLD_WARNING = 100 * 1024;
  const THRESHOLD_ERROR = 500 * 1024;
  const MAX_DISPLAY = 1024 * 1024; // 1MB for visualization

  const percentage = Math.min(100, (size / MAX_DISPLAY) * 100);
  const getColorClass = (): string => {
    if (size >= THRESHOLD_ERROR) return styles['sizeError'] ?? '';
    if (size >= THRESHOLD_WARNING) return styles['sizeWarning'] ?? '';
    return styles['sizeGood'] ?? '';
  };

  return (
    <div className={styles['sizeBar']}>
      <div className={styles['sizeBarTrack']}>
        <div className={`${styles['sizeBarFill']} ${getColorClass()}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};

interface StreamingProgressProps {
  /** Number of chunks streamed */
  chunkCount: number;
  /** Total stream duration in ms */
  streamDuration: number;
}

/**
 * Shows streaming progress and chunk count
 */
export const StreamingProgress: React.FC<StreamingProgressProps> = ({
  chunkCount,
  streamDuration,
}) => {
  return (
    <div className={styles['streamingProgress']}>
      <div className={styles['chunkIndicator']}>
        <Icon name="timeline" size={14} />
        <span className={styles['chunkCount']}>{chunkCount} chunks</span>
      </div>
      <div className={styles['durationIndicator']}>
        <Icon name="time" size={14} />
        <span>{formatDuration(streamDuration)}</span>
      </div>
    </div>
  );
};

/* ============================================================================
   Utility Functions
   ============================================================================ */

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format duration in ms to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

type IconName =
  | 'record'
  | 'stop'
  | 'clear'
  | 'download'
  | 'upload'
  | 'search'
  | 'filter'
  | 'settings'
  | 'close'
  | 'check'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-left'
  | 'warning'
  | 'error'
  | 'info'
  | 'success'
  | 'tree'
  | 'flame'
  | 'timeline'
  | 'chart'
  | 'component'
  | 'memo'
  | 'dom'
  | 'forward'
  | 'context'
  | 'lightbulb'
  | 'spinner'
  | 'pause'
  | 'play'
  | 'trash'
  | 'copy'
  | 'refresh'
  | 'dot'
  | 'commit'
  | 'performance'
  | 'time'
  | 'analysis'
  | 'expand'
  | 'collapse'
  | 'moon';

export default RSCAnalysis;
