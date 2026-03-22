/**
 * Plugin Metrics Panel
 * @module panel/components/Plugins/PluginMetricsPanel
 *
 * Displays metrics contributed by all enabled plugins.
 * Aggregates metrics from the PluginManager and renders them in a grid.
 */

import type React from 'react';
import { useMemo } from 'react';
import { Panel, PanelSection } from '../Common/Panel/Panel';
import { Badge } from '../Common/Badge/Badge';
import { Icon } from '../Common/Icon/Icon';
import { Tooltip } from '../Common/Tooltip/Tooltip';
import type { PluginMetric } from '@/panel/plugins/types';
import styles from './PluginMetricsPanel.module.css';

interface PluginMetricsPanelProps {
  /** Array of plugin metrics to display */
  metrics: PluginMetric[];
  /** Whether the panel is loading */
  isLoading?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * Group metrics by category
 */
function groupMetricsByCategory(metrics: PluginMetric[]): Map<string, PluginMetric[]> {
  const groups = new Map<string, PluginMetric[]>();

  for (const metric of metrics) {
    const category = metric.category || 'General';
    const existing = groups.get(category) || [];
    existing.push(metric);
    groups.set(category, existing);
  }

  // Sort each group by priority
  for (const [category, categoryMetrics] of groups) {
    groups.set(
      category,
      categoryMetrics.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
    );
  }

  return groups;
}

/**
 * Get trend icon based on trend direction
 */
function TrendIcon({ trend, positive }: { trend?: 'up' | 'down' | 'neutral'; positive?: boolean }): React.ReactElement | null {
  if (!trend || trend === 'neutral') return null;

  const iconName = trend === 'up' ? 'chevron-up' : 'chevron-down';
  const colorClass = positive
    ? styles['trendPositive']
    : trend === 'up'
      ? styles['trendNegative']
      : styles['trendPositive'];

  return <Icon name={iconName} size={14} className={`${styles['trendIcon']} ${colorClass}`} />;
}

/**
 * Single metric card component
 */
function MetricCard({ metric }: { metric: PluginMetric }): React.ReactElement {
  const displayValue = metric.formattedValue ?? String(metric.value);
  const hasTrend = !!metric.trend && metric.trend !== 'neutral';

  return (
    <Tooltip content={metric.description} disabled={!metric.description}>
      <div className={styles['metricCard']}>
        <div className={styles['metricHeader']}>
          <span className={styles['metricName']}>{metric.name}</span>
          {hasTrend && (
            <TrendIcon trend={metric.trend} positive={metric.trendPositive} />
          )}
        </div>
        <div className={styles['metricValue']}>{displayValue}</div>
        {metric.unit && <div className={styles['metricUnit']}>{metric.unit}</div>}
      </div>
    </Tooltip>
  );
}

/**
 * Category section component
 */
function CategorySection({
  category,
  metrics,
}: {
  category: string;
  metrics: PluginMetric[];
}): React.ReactElement {
  return (
    <PanelSection title={category} collapsible defaultCollapsed={false}>
      <div className={styles['metricsGrid']}>
        {metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </div>
    </PanelSection>
  );
}

/**
 * Plugin Metrics Panel
 *
 * Displays a comprehensive view of all plugin-contributed metrics,
 * organized by category.
 *
 * @example
 * ```tsx
 * <PluginMetricsPanel
 *   metrics={pluginManager.getAllPluginMetrics()}
 *   isLoading={isAnalyzing}
 * />
 * ```
 */
export const PluginMetricsPanel: React.FC<PluginMetricsPanelProps> = ({
  metrics,
  isLoading = false,
  className,
}) => {
  const groupedMetrics = useMemo(() => groupMetricsByCategory(metrics), [metrics]);

  if (isLoading) {
    return (
      <Panel title="Plugin Metrics" icon="chart" className={className}>
        <div className={styles['loading']}>
          <div className={styles['spinner']} />
          <span>Loading metrics...</span>
        </div>
      </Panel>
    );
  }

  if (metrics.length === 0) {
    return (
      <Panel title="Plugin Metrics" icon="chart" className={className}>
        <div className={styles['empty']}>
          <Icon name="info" size={24} className={styles['emptyIcon']} />
          <p>No plugin metrics available</p>
          <small>Enable plugins to see their metrics here</small>
        </div>
      </Panel>
    );
  }

  const totalCategories = groupedMetrics.size;
  const totalMetrics = metrics.length;

  return (
    <Panel
      title="Plugin Metrics"
      icon="chart"
      className={className}
      actions={
        <Badge variant="secondary">
          {totalMetrics} metric{totalMetrics !== 1 ? 's' : ''} · {totalCategories} categor{totalCategories !== 1 ? 'ies' : 'y'}
        </Badge>
      }
    >
      <div className={styles['container']}>
        {Array.from(groupedMetrics.entries()).map(([category, categoryMetrics]) => (
          <CategorySection
            key={category}
            category={category}
            metrics={categoryMetrics}
          />
        ))}
      </div>
    </Panel>
  );
};

export default PluginMetricsPanel;
