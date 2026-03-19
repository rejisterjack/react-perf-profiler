import type React from 'react';
import type { MemoEffectivenessReport } from '@/shared/types';
import { Badge } from '../Common/Badge/Badge';
import { Icon } from '../Common/Icon/Icon';
import styles from './MemoEffectiveness.module.css';

interface MemoEffectivenessProps {
  reports: MemoEffectivenessReport[];
}

export const MemoEffectiveness: React.FC<MemoEffectivenessProps> = ({ reports }) => {
  const ineffectiveCount = reports.filter((r) => !r.isEffective).length;

  return (
    <div className={styles["report"]}>
      <div className={styles["header"]}>
        <h3>
          <Icon name="memo" size={16} />
          Memoization Effectiveness
        </h3>
        <Badge variant={ineffectiveCount > 0 ? 'warning' : 'success'}>
          {ineffectiveCount} Issues
        </Badge>
      </div>

      {reports.length === 0 ? (
        <div className={styles["empty"]}>
          <Icon name="info" size={20} />
          <p>No memoized components found</p>
        </div>
      ) : (
        <ul className={styles["list"]}>
          {reports.slice(0, 10).map((report) => (
            <li key={report.componentName} className={styles["item"]}>
              <div className={styles["itemHeader"]}>
                <span className={styles["name"]}>{report.componentName}</span>
                <div className={styles["badges"]}>
                  <Badge variant={report.isEffective ? 'success' : 'warning'}>
                    {Math.round(report.currentHitRate)}%
                  </Badge>
                </div>
              </div>

              {!report.isEffective && report.issues.length > 0 && (
                <ul className={styles["issues"]}>
                  {report.issues.slice(0, 3).map((issue, i) => (
                    <li key={i} className={styles["issue"]}>
                      <Icon name="warning" size={12} />
                      <span>{issue.suggestion}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className={styles["potential"]}>
                <span className={styles["potentialLabel"]}>Potential:</span>
                <span className={styles["potentialValue"]}>
                  {Math.round(report.optimalHitRate)}%
                </span>
                {!report.isEffective && (
                  <span className={styles["improvement"]}>
                    (+{Math.round(report.optimalHitRate - report.currentHitRate)}%)
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MemoEffectiveness;
