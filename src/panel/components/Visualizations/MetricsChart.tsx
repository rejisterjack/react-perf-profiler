/**
 * MetricsChart Component
 * Visualizes performance metrics over time using various chart types
 * Includes bar charts for render counts and line charts for duration trends
 */

import type React from 'react';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { useProfilerStore } from '@/panel/stores/profilerStore';

import styles from './MetricsChart.module.css';

type ChartType = 'renders' | 'duration' | 'components';

interface MetricPoint {
  timestamp: number;
  value: number;
  commitId: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  data: MetricPoint | null;
  label: string;
}

const MARGIN = { top: 20, right: 30, bottom: 50, left: 70 };

/**
 * MetricsChart visualization component
 * Displays performance metrics using different chart visualizations
 */
export const MetricsChart: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { commits } = useProfilerStore();
  const [chartType, setChartType] = useState<ChartType>('renders');
  const [dimensions, setDimensions] = useState({ width: 800, height: 300 });
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    data: null,
    label: '',
  });

  // Measure container size
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Process data based on chart type
  const chartData = useMemo(() => {
    if (commits.length === 0) return [];

    const data: MetricPoint[] = commits.map((commit) => {
      let value: number;

      switch (chartType) {
        case 'renders':
          value = commit.nodes?.length || 0;
          break;
        case 'duration':
          value = commit.duration;
          break;
        case 'components':
          value = new Set(commit.nodes?.map((f) => f.displayName)).size;
          break;
        default:
          value = 0;
      }

      return {
        timestamp: commit.timestamp,
        value,
        commitId: commit.id,
      };
    });

    return data.sort((a, b) => a.timestamp - b.timestamp);
  }, [commits, chartType]);

  // Get label and color based on chart type
  const getChartConfig = useCallback((type: ChartType) => {
    switch (type) {
      case 'renders':
        return {
          label: 'Renders per Commit',
          yAxisLabel: 'Render Count',
          color: '#60a5fa',
          fillColor: 'rgba(96, 165, 250, 0.3)',
        };
      case 'duration':
        return {
          label: 'Commit Duration',
          yAxisLabel: 'Duration (ms)',
          color: '#fbbf24',
          fillColor: 'rgba(251, 191, 36, 0.3)',
        };
      case 'components':
        return {
          label: 'Unique Components',
          yAxisLabel: 'Component Count',
          color: '#4ade80',
          fillColor: 'rgba(74, 222, 128, 0.3)',
        };
      default:
        return {
          label: '',
          yAxisLabel: '',
          color: '#6b7280',
          fillColor: 'rgba(107, 114, 128, 0.3)',
        };
    }
  }, []);

  // Show tooltip
  const showTooltip = useCallback(
    (event: MouseEvent, d: MetricPoint) => {
      const config = getChartConfig(chartType);
      setTooltip({
        visible: true,
        x: event.clientX + 10,
        y: event.clientY - 10,
        data: d,
        label: config.label,
      });
    },
    [chartType, getChartConfig]
  );

  // Hide tooltip
  const hideTooltip = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  // Render chart with D3
  useEffect(() => {
    if (!svgRef.current || chartData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = height - MARGIN.top - MARGIN.bottom;
    const config = getChartConfig(chartType);

    // Create main group
    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Create scales
    const xScale = d3
      .scaleBand()
      .domain(chartData.map((d) => d.timestamp.toString()))
      .range([0, innerWidth])
      .padding(0.2);

    const yScale = d3
      .scaleLinear()
      .domain([0, (d3.max(chartData, (d) => d.value) || 0) * 1.1])
      .nice()
      .range([innerHeight, 0]);

    // Add axes
    g.append('g')
      .attr('class', styles["axis"]!)
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickFormat((d) => {
            const timestamp = parseInt(d as string, 10);
            const firstTimestamp = chartData[0]?.timestamp || timestamp;
            return `${((timestamp - firstTimestamp) / 1000).toFixed(1)}s`;
          })
          .tickValues(
            xScale.domain().filter((_, i) => {
              // Show fewer ticks for large datasets
              const step = Math.max(1, Math.floor(chartData.length / 10));
              return i % step === 0;
            })
          )
      );

    g.append('g').attr('class', styles["axis"]!).call(d3.axisLeft(yScale).ticks(5));

    // Add axis labels
    g.append('text')
      .attr('class', styles["axisLabel"]!)
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .text('Time (seconds)');

    g.append('text')
      .attr('class', styles["axisLabel"]!)
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -50)
      .attr('text-anchor', 'middle')
      .text(config.yAxisLabel);

    // Add grid lines
    g.append('g')
      .attr('class', styles["grid"]!)
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      );

    // Create gradient for area fill
    const gradient = svg
      .append('defs')
      .append('linearGradient')
      .attr('id', 'area-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', config.color)
      .attr('stop-opacity', 0.3);

    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', config.color)
      .attr('stop-opacity', 0.05);

    // Add bars
    const bars = g
      .selectAll('rect')
      .data(chartData)
      .join('rect')
      .attr('class', styles["bar"]!)
      .attr('x', (d) => xScale(d.timestamp.toString()) || 0)
      .attr('y', innerHeight)
      .attr('width', xScale.bandwidth())
      .attr('height', 0)
      .attr('fill', config.color)
      .attr('rx', 2)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 0.8);
        showTooltip(event as unknown as MouseEvent, d);
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 1);
        hideTooltip();
      });

    // Animate bars
    bars
      .transition()
      .duration(500)
      .delay((_, i) => i * 20)
      .attr('y', (d) => yScale(d.value))
      .attr('height', (d) => innerHeight - yScale(d.value));

    // Add average line
    const average = d3.mean(chartData, (d) => d.value) || 0;
    g.append('line')
      .attr('class', styles["averageLine"]!)
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yScale(average))
      .attr('y2', yScale(average));

    // Add average label
    g.append('text')
      .attr('class', styles["averageLabel"]!)
      .attr('x', innerWidth - 5)
      .attr('y', yScale(average) - 5)
      .attr('text-anchor', 'end')
      .text(`Avg: ${average.toFixed(1)}`);
  }, [chartData, dimensions, chartType, getChartConfig, showTooltip, hideTooltip]);

  if (commits.length === 0) {
    return (
      <div className={styles["empty"]}>
        <div className={styles["emptyIcon"]}>📊</div>
        <p>Record commits to see metrics</p>
      </div>
    );
  }

  const stats = useMemo(() => {
    if (chartData.length === 0) return null;

    const values = chartData.map((d) => d.value);
    const total = values.reduce((a, b) => a + b, 0);
    const average = total / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);

    return { total, average, max, min };
  }, [chartData]);

  return (
    <div ref={containerRef} className={styles["container"]}>
      <div className={styles["header"]}>
        <h3 className={styles["title"]}>Performance Metrics</h3>
        <div className={styles["chartControls"]}>
          <button
            type="button"
            className={`${styles["chartButton"]} ${chartType === 'renders' ? styles["active"] : ''}`}
            onClick={() => setChartType('renders')}
          >
            Renders
          </button>
          <button
            type="button"
            className={`${styles["chartButton"]} ${chartType === 'duration' ? styles["active"] : ''}`}
            onClick={() => setChartType('duration')}
          >
            Duration
          </button>
          <button
            type="button"
            className={`${styles["chartButton"]} ${chartType === 'components' ? styles["active"] : ''}`}
            onClick={() => setChartType('components')}
          >
            Components
          </button>
        </div>
      </div>

      {stats && (
        <div className={styles["stats"]}>
          <div className={styles["statItem"]}>
            <span className={styles["statLabel"]}>Total</span>
            <span className={styles["statValue"]}>{stats.total.toFixed(0)}</span>
          </div>
          <div className={styles["statItem"]}>
            <span className={styles["statLabel"]}>Average</span>
            <span className={styles["statValue"]}>{stats.average.toFixed(1)}</span>
          </div>
          <div className={styles["statItem"]}>
            <span className={styles["statLabel"]}>Max</span>
            <span className={styles["statValue"]}>{stats.max.toFixed(1)}</span>
          </div>
          <div className={styles["statItem"]}>
            <span className={styles["statLabel"]}>Min</span>
            <span className={styles["statValue"]}>{stats.min.toFixed(1)}</span>
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        className={styles["svg"]}
        width={dimensions.width}
        height={dimensions.height}
      />

      <Tooltip tooltip={tooltip} />
    </div>
  );
};

/**
 * Tooltip component for chart data
 */
const Tooltip: React.FC<{ tooltip: TooltipState }> = ({ tooltip }) => {
  if (!tooltip.visible || !tooltip.data) return null;

  const { data, label } = tooltip;

  return (
    <div
      className={styles["tooltip"]}
      style={{
        left: tooltip.x,
        top: tooltip.y,
      }}
    >
      <div className={styles["tooltipHeader"]}>{label}</div>
      <div className={styles["tooltipContent"]}>
        <div className={styles["tooltipRow"]}>
          <span className={styles["tooltipLabel"]}>Time:</span>
          <span className={styles["tooltipValue"]}>{(data.timestamp / 1000).toFixed(2)}s</span>
        </div>
        <div className={styles["tooltipRow"]}>
          <span className={styles["tooltipLabel"]}>Value:</span>
          <span className={styles["tooltipValue"]}>{data.value.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default MetricsChart;
