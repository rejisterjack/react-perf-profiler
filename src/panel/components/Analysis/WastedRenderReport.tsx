import React, { useMemo } from 'react';
import { WastedRenderReport as WastedRenderReportType } from '@/shared/types';
import { Badge } from '../Common/Badge/Badge';
import { Icon } from '../Common/Icon/Icon';
import styles from './WastedRenderReport.module.css';

interface WastedRenderReportProps {
  reports: WastedRenderReportType[];
}

export const WastedRenderReport: React.FC<WastedRenderReportProps> = ({ reports }) => {
  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => b.wastedRenderRate - a.wastedRenderRate);
  }, [reports]);
  
  const criticalCount = reports.filter(r => r.severity === 'critical').length;
  
  return (
    <div className={styles.report}>
      <div className={styles.header}>
        <h3>
          <Icon name="warning" />
          Wasted Renders
        </h3>
        <Badge variant="error">{criticalCount} Critical</Badge>
      </div>
      
      {sortedReports.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="check" size="lg" />
          <p>No wasted renders detected!</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {sortedReports.slice(0, 10).map((report) => (
            <li key={report.componentName} className={styles.item}>
              <div className={styles.itemHeader}>
                <span className={styles.name}>{report.componentName}</span>
                <Badge variant={report.severity}>
                  {Math.round(report.wastedRenderRate)}%
                </Badge>
              </div>
              
              <div className={styles.stats}>
                <span>{report.totalRenders} renders</span>
                <span className={styles.dot}>•</span>
                <span>{report.wastedRenders} wasted</span>
                <span className={styles.dot}>•</span>
                <span>{report.estimatedSavingsMs.toFixed(1)}ms saved</span>
              </div>
              
              <div className={styles.recommendation}>
                <Icon name="info" size="xs" />
                <span>{getActionLabel(report.recommendedAction)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    memo: 'Wrap with React.memo',
    useMemo: 'Use useMemo for expensive calculations',
    useCallback: 'Wrap callbacks with useCallback',
    colocate: 'Colocate state to reduce prop drilling',
    none: 'No action needed',
  };
  return labels[action] || action;
}

export default WastedRenderReport;
