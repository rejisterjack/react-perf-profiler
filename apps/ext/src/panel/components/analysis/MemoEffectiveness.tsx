/**
 * MemoEffectiveness — displays memoization metrics for each memoized component.
 * Shows hit rate with Progress bar, effectiveness indicator, issues, and recommendations.
 */

import type { MemoReport as MemoReportType, Severity } from '@/src/shared/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface MemoEffectivenessProps {
  reports: MemoReportType[];
}

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: 'bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400',
  high: 'bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-400',
  medium: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30 dark:text-yellow-400',
  low: 'bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400',
};

const ISSUE_TYPE_LABELS: Record<string, string> = {
  'unstable-callback': 'Unstable Callback',
  'unstable-object': 'Unstable Object',
  'unstable-array': 'Unstable Array',
  'inline-jsx': 'Inline JSX',
  'deep-prop': 'Deep Prop',
};

function getProgressColor(hitRate: number): string {
  if (hitRate >= 70) return '[&>div]:bg-emerald-500';
  if (hitRate >= 40) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-red-500';
}

function getHitRateLabel(hitRate: number): string {
  if (hitRate >= 80) return 'Excellent';
  if (hitRate >= 60) return 'Good';
  if (hitRate >= 40) return 'Poor';
  return 'Ineffective';
}

export function MemoEffectiveness({ reports }: MemoEffectivenessProps) {
  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">No memoized components detected.</p>
        <p className="text-xs mt-1">
          Components wrapped with React.memo() or PureComponent will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Memoization Analysis ({reports.length} components)
        </h3>
      </div>

      <div className="flex flex-col gap-3">
        {reports.map((report) => (
          <Card
            key={report.componentName}
            size="sm"
            className={cn(
              report.isEffective
                ? 'border-l-2 border-l-emerald-500'
                : 'border-l-2 border-l-red-500',
            )}
          >
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-mono">
                  {report.componentName}
                </CardTitle>
                <div className="flex items-center gap-1.5 shrink-0">
                  {report.isEffective ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
                    >
                      <svg
                        className="size-3 mr-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Effective
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400"
                    >
                      <svg
                        className="size-3 mr-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Ineffective
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Hit Rate */}
              <div className="mt-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">
                    Hit Rate: {report.currentHitRate}% ({getHitRateLabel(report.currentHitRate)})
                  </span>
                  <span className="text-muted-foreground">
                    Target: {report.optimalHitRate}%
                  </span>
                </div>
                <Progress
                  value={report.currentHitRate}
                  className={cn('h-2', getProgressColor(report.currentHitRate))}
                />
              </div>

              {/* Issues */}
              {report.issues.length > 0 && (
                <div className="mt-3 pt-2 border-t border-border">
                  <p className="text-[10px] text-muted-foreground mb-1.5">
                    Detected Issues ({report.issues.length})
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {report.issues.map((issue, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] shrink-0 mt-0.5',
                            SEVERITY_STYLES[issue.severity],
                          )}
                        >
                          {ISSUE_TYPE_LABELS[issue.type] ?? issue.type}
                        </Badge>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          {issue.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {report.recommendations.length > 0 && (
                <div className="mt-3 pt-2 border-t border-border">
                  <p className="text-[10px] text-muted-foreground mb-1.5">
                    Recommendations
                  </p>
                  <div className="flex flex-col gap-2">
                    {report.recommendations.map((rec, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <p className="text-[11px] text-foreground">
                          {rec.description}
                        </p>
                        {rec.codeExample && (
                          <pre className="rounded-md bg-muted/80 p-2 text-[10px] font-mono text-muted-foreground overflow-x-auto">
                            <code>{rec.codeExample}</code>
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
