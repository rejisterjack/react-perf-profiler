/**
 * Performance Dashboard
 * Historical performance trends and regression detection
 * @module panel/components/Dashboard/PerformanceDashboard
 */

import type React from 'react';
import { useState, useEffect, useMemo } from 'react';
import styles from './PerformanceDashboard.module.css';

/**
 * Historical data point
 */
interface DataPoint {
  timestamp: number;
  date: string;
  score: number;
  wastedRenderRate: number;
  averageRenderTime: number;
  commitCount: number;
  bundleSize: number;
}

/**
 * Performance Dashboard Component
 */
export const PerformanceDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('week');
  const [data, setData] = useState<DataPoint[]>([]);

  // Generate mock historical data
  useEffect(() => {
    const generateData = (): DataPoint[] => {
      const points: DataPoint[] = [];
      const now = Date.now();
      const days = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90;

      for (let i = days; i >= 0; i--) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000);
        points.push({
          timestamp: date.getTime(),
          date: date.toLocaleDateString(),
          score: 60 + Math.random() * 30 + Math.sin(i / 5) * 10,
          wastedRenderRate: 10 + Math.random() * 20,
          averageRenderTime: 8 + Math.random() * 8,
          commitCount: Math.floor(50 + Math.random() * 100),
          bundleSize: 500000 + Math.random() * 200000,
        });
      }

      return points;
    };

    setData(generateData());
  }, [timeRange]);

  // Calculate trends
  const trends = useMemo(() => {
    if (data.length < 2) return null;

    const recent = data.slice(-7);
    const previous = data.slice(-14, -7);

    const avg = (arr: DataPoint[], key: keyof DataPoint) =>
      arr.reduce((sum, p) => sum + (p[key] as number), 0) / arr.length;

    const scoreChange = avg(recent, 'score') - avg(previous, 'score');
    const wastedChange = avg(recent, 'wastedRenderRate') - avg(previous, 'wastedRenderRate');
    const timeChange = avg(recent, 'averageRenderTime') - avg(previous, 'averageRenderTime');

    return {
      scoreChange,
      wastedChange,
      timeChange,
      isImproving: scoreChange > 0 && wastedChange < 0,
    };
  }, [data]);

  // Detect regressions
  const regressions = useMemo(() => {
    const issues: Array<{ date: string; metric: string; change: string }> = [];

    for (let i = 1; i < data.length; i++) {
      const current = data[i]!;
      const previous = data[i - 1]!;

      if (current.score < previous.score - 10) {
        issues.push({
          date: current.date,
          metric: 'Performance Score',
          change: `-${(previous.score - current.score).toFixed(1)}`,
        });
      }

      if (current.wastedRenderRate > previous.wastedRenderRate + 5) {
        issues.push({
          date: current.date,
          metric: 'Wasted Renders',
          change: `+${(current.wastedRenderRate - previous.wastedRenderRate).toFixed(1)}%`,
        });
      }
    }

    return issues.slice(-5);
  }, [data]);

  // Current stats
  const current = data[data.length - 1]!;
  const baseline = data[0]!;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>📊 Performance Dashboard</h2>
        <div className={styles.timeRange}>
          {(['week', 'month', 'quarter'] as const).map(range => (
            <button
              key={range}
              className={timeRange === range ? styles.active : ''}
              onClick={() => setTimeRange(range)}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {current && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Current Score</span>
            <span className={styles.statValue}>{current.score.toFixed(0)}</span>
            {trends && (
              <span className={`${styles.trend} ${trends.scoreChange > 0 ? styles.up : styles.down}`}>
                {trends.scoreChange > 0 ? '↑' : '↓'} {Math.abs(trends.scoreChange).toFixed(1)}
              </span>
            )}
          </div>

          <div className={styles.statCard}>
            <span className={styles.statLabel}>Wasted Renders</span>
            <span className={styles.statValue}>{current.wastedRenderRate.toFixed(1)}%</span>
            {trends && (
              <span className={`${styles.trend} ${trends.wastedChange < 0 ? styles.up : styles.down}`}>
                {trends.wastedChange < 0 ? '↓' : '↑'} {Math.abs(trends.wastedChange).toFixed(1)}%
              </span>
            )}
          </div>

          <div className={styles.statCard}>
            <span className={styles.statLabel}>Avg Render Time</span>
            <span className={styles.statValue}>{current.averageRenderTime.toFixed(1)}ms</span>
            {trends && (
              <span className={`${styles.trend} ${trends.timeChange < 0 ? styles.up : styles.down}`}>
                {trends.timeChange < 0 ? '↓' : '↑'} {Math.abs(trends.timeChange).toFixed(1)}ms
              </span>
            )}
          </div>

          <div className={styles.statCard}>
            <span className={styles.statLabel}>Bundle Size</span>
            <span className={styles.statValue}>{(current.bundleSize / 1024).toFixed(0)}KB</span>
            <span className={styles.trend}>
              {current.bundleSize > baseline.bundleSize ? '↑' : '↓'}
            </span>
          </div>
        </div>
      )}

      <div className={styles.chartsSection}>
        <h3>Performance Trend</h3>
        <div className={styles.chart}>
          <SimpleLineChart data={data} dataKey="score" color="#4da6ff" />
        </div>
      </div>

      <div className={styles.regressionsSection}>
        <h3>Recent Regressions</h3>
        {regressions.length === 0 ? (
          <p className={styles.noIssues}>✅ No regressions detected in this period</p>
        ) : (
          <table className={styles.regressionsTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Metric</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {regressions.map((reg, i) => (
                <tr key={i}>
                  <td>{reg.date}</td>
                  <td>{reg.metric}</td>
                  <td className={styles.negative}>{reg.change}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

/**
 * Simple SVG Line Chart
 */
const SimpleLineChart: React.FC<{
  data: DataPoint[];
  dataKey: keyof DataPoint;
  color: string;
}> = ({ data, dataKey, color }) => {
  if (data.length < 2) return null;

  const values = data.map(d => d[dataKey] as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 800;
  const height = 200;
  const padding = 20;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((d[dataKey] as number) - min) / range * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={styles.lineChart}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
      />
      {data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((d[dataKey] as number) - min) / range * (height - 2 * padding);
        return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
      })}
    </svg>
  );
};

export default PerformanceDashboard;
