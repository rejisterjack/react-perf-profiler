import type React from 'react';
import { useMemo, useState } from 'react';
import type { WastedRenderReport, MemoReport } from '@/shared/types';
import { generateAIOptimizations, type AIOptimizationSuggestion } from '@/panel/utils/aiOptimizationGenerator';
import { Icon } from '../Common/Icon/Icon';
import styles from './OptimizationSuggestions.module.css';

interface OptimizationSuggestionsProps {
  wastedReports: WastedRenderReport[];
  memoReports: MemoReport[];
}

export const OptimizationSuggestions: React.FC<OptimizationSuggestionsProps> = ({
  wastedReports,
  memoReports,
}) => {
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    // Use AI optimization generator for comprehensive suggestions
    // Type cast needed due to interface differences between shared/types and analysis utils
    return generateAIOptimizations(
      wastedReports as unknown as Parameters<typeof generateAIOptimizations>[0],
      memoReports as unknown as Parameters<typeof generateAIOptimizations>[1]
    );
  }, [wastedReports, memoReports]);

  const handleCopyCode = async (suggestion: AIOptimizationSuggestion) => {
    try {
      await navigator.clipboard.writeText(suggestion.suggestedCode);
      setCopiedId(suggestion.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore copy errors
    }
  };

  const handleToggleExpand = (id: string) => {
    setExpandedSuggestion(expandedSuggestion === id ? null : id);
  };

  if (suggestions.length === 0) {
    return (
      <div className={styles['suggestions']}>
        <div className={styles['header']}>
          <h3>
            <Icon name="check" size={16} />
            AI Optimization Suggestions
          </h3>
        </div>
        <div className={styles['allGood']}>
          <div className={styles['successIcon']}>
            <Icon name="check" size={24} />
          </div>
          <h4>All Good!</h4>
          <p>
            No optimization suggestions at this time. Your React components are performing well.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles['suggestions']}>
      <div className={styles['header']}>
        <h3>
          <Icon name="performance" size={16} />
          AI Optimization Suggestions
        </h3>
        <span className={styles['count']}>
          {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
        </span>
      </div>

      <ul className={styles['list']}>
        {suggestions.map((suggestion) => (
          <li
            key={suggestion.id}
            className={`${styles['suggestion']} ${styles[suggestion.severity]}`}
          >
            <div className={styles['suggestionHeader']}>
              <div className={styles['iconWrapper']}>
                <Icon name={getIconName(suggestion.severity)} size={16} />
              </div>
              <div className={styles['titleWrapper']}>
                <h4>{suggestion.description}</h4>
                <code className={styles['component']}>{suggestion.componentName}</code>
              </div>
              <span className={`${styles['badge']} ${styles[suggestion.severity]}`}>
                {suggestion.severity}
              </span>
            </div>

            <p className={styles['explanation']}>{suggestion.explanation}</p>

            <div className={styles['impact']}>
              <Icon name="time" size={12} />
              <span>Estimated improvement: {suggestion.estimatedImprovement}</span>
            </div>

            <button
              type="button"
              className={styles['expandButton']}
              onClick={() => handleToggleExpand(suggestion.id)}
            >
              {expandedSuggestion === suggestion.id ? 'Hide Code' : 'View Code Fix'}
              <Icon
                name={expandedSuggestion === suggestion.id ? 'chevron-up' : 'chevron-down'}
                size={12}
              />
            </button>

            {expandedSuggestion === suggestion.id && (
              <div className={styles['codeSection']}>
                <div className={styles['codeBlock']}>
                  <div className={styles['codeHeader']}>
                    <span>Current Code</span>
                  </div>
                  <pre className={styles['code']}>
                    <code>{suggestion.currentCode}</code>
                  </pre>
                </div>

                <div className={styles['codeArrow']}>↓</div>

                <div className={styles['codeBlock']}>
                  <div className={styles['codeHeader']}>
                    <span>Suggested Fix</span>
                    <button
                      type="button"
                      className={styles['copyButton']}
                      onClick={() => handleCopyCode(suggestion)}
                    >
                      <Icon name={copiedId === suggestion.id ? 'check' : 'copy'} size={12} />
                      {copiedId === suggestion.id ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className={`${styles['code']} ${styles['suggested']}`}>
                    <code>{suggestion.suggestedCode}</code>
                  </pre>
                </div>
              </div>
            )}
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

export default OptimizationSuggestions;
