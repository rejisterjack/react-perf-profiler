import React, { useMemo } from 'react';
import { WastedRenderReport, MemoEffectivenessReport } from '@/shared/types';
import { Icon } from '../Common/Icon/Icon';
import styles from './OptimizationSuggestions.module.css';

interface OptimizationSuggestionsProps {
  wastedReports: WastedRenderReport[];
  memoReports: MemoEffectivenessReport[];
}

interface Suggestion {
  id: string;
  type: 'critical' | 'warning' | 'info';
  component: string;
  title: string;
  description: string;
  codeExample?: string;
  estimatedImpact: string;
}

export const OptimizationSuggestions: React.FC<OptimizationSuggestionsProps> = ({
  wastedReports,
  memoReports,
}) => {
  const suggestions = useMemo(() => {
    const result: Suggestion[] = [];
    
    // Generate suggestions from wasted render reports
    wastedReports.forEach((report) => {
      if (report.severity === 'critical') {
        result.push({
          id: `wasted-${report.componentName}`,
          type: 'critical',
          component: report.componentName,
          title: `High wasted render rate in ${report.componentName}`,
          description: `This component rendered ${report.totalRenders} times but ${report.wastedRenders} renders were unnecessary (${Math.round(report.wastedRenderRate)}%).`,
          codeExample: getCodeExample(report.recommendedAction),
          estimatedImpact: `~${report.estimatedSavingsMs.toFixed(1)}ms per interaction`,
        });
      }
    });
    
    // Generate suggestions from memo effectiveness reports
    memoReports.forEach((report) => {
      if (!report.isEffective && report.issues.length > 0) {
        report.issues.forEach((issue, index) => {
          result.push({
            id: `memo-${report.componentName}-${index}`,
            type: 'warning',
            component: report.componentName,
            title: `Memoization issue: ${issue.type}`,
            description: issue.suggestion,
            estimatedImpact: `Potential ${Math.round(report.optimalHitRate - report.currentHitRate)}% improvement`,
          });
        });
      }
    });
    
    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return result.sort((a, b) => severityOrder[a.type] - severityOrder[b.type]);
  }, [wastedReports, memoReports]);

  if (suggestions.length === 0) {
    return (
      <div className={styles.suggestions}>
        <div className={styles.header}>
          <h3>
            <Icon name="check" />
            Optimization Suggestions
          </h3>
        </div>
        <div className={styles.allGood}>
          <div className={styles.successIcon}>
            <Icon name="check" size="xl" />
          </div>
          <h4>All Good!</h4>
          <p>No optimization suggestions at this time. Your React components are performing well.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.suggestions}>
      <div className={styles.header}>
        <h3>
          <Icon name="performance" />
          Optimization Suggestions
        </h3>
        <span className={styles.count}>
          {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <ul className={styles.list}>
        {suggestions.map((suggestion) => (
          <li
            key={suggestion.id}
            className={`${styles.suggestion} ${styles[suggestion.type]}`}
          >
            <div className={styles.suggestionHeader}>
              <div className={styles.iconWrapper}>
                <Icon name={getIconName(suggestion.type)} size="sm" />
              </div>
              <div className={styles.titleWrapper}>
                <h4>{suggestion.title}</h4>
                <code className={styles.component}>{suggestion.component}</code>
              </div>
              <span className={`${styles.badge} ${styles[suggestion.type]}`}>
                {suggestion.type}
              </span>
            </div>
            
            <p className={styles.description}>{suggestion.description}</p>
            
            {suggestion.codeExample && (
              <pre className={styles.code}>
                <code>{suggestion.codeExample}</code>
              </pre>
            )}
            
            <div className={styles.impact}>
              <Icon name="time" size="xs" />
              <span>Estimated impact: {suggestion.estimatedImpact}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

function getIconName(type: 'critical' | 'warning' | 'info'): 'error' | 'warning' | 'info' {
  switch (type) {
    case 'critical':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'info';
  }
}

function getCodeExample(action: string): string | undefined {
  switch (action) {
    case 'memo':
      return `const MyComponent = React.memo(function MyComponent(props) {
  // Component logic
});`;
    case 'useCallback':
      return `const handleClick = useCallback(() => {
  // Handler logic
}, [/* deps */]);`;
    case 'useMemo':
      return `const computed = useMemo(() => {
  return expensiveCalculation(props.data);
}, [props.data]);`;
    default:
      return undefined;
  }
}

export default OptimizationSuggestions;
