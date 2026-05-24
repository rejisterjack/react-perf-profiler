/**
 * WastedRenderReport — table/card view of wasted render issues.
 * Shows component name, total renders, wasted renders, rate, severity, and recommended action.
 */

import type { Severity, WastedRenderReport as WastedRenderReportType } from '@/src/shared/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface WastedRenderReportProps {
  reports: WastedRenderReportType[];
}

const SEVERITY_STYLES: Record<Severity, { badge: string; dot: string; bg: string }> = {
  critical: {
    badge: 'bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400',
    dot: 'bg-red-500',
    bg: 'border-l-red-500',
  },
  high: {
    badge: 'bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-400',
    dot: 'bg-orange-500',
    bg: 'border-l-orange-500',
  },
  medium: {
    badge: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30 dark:text-yellow-400',
    dot: 'bg-yellow-500',
    bg: 'border-l-yellow-500',
  },
  low: {
    badge: 'bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400',
    dot: 'bg-green-500',
    bg: 'border-l-green-500',
  },
};

const ACTION_STYLES: Record<string, string> = {
  memo: 'bg-violet-500/15 text-violet-700 border-violet-500/30 dark:text-violet-400',
  useMemo: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400',
  useCallback: 'bg-cyan-500/15 text-cyan-700 border-cyan-500/30 dark:text-cyan-400',
  none: 'bg-muted text-muted-foreground',
};

function formatSavings(ms: number): string {
  if (ms < 1) return `${Math.round(ms * 1000)}us`;
  if (ms < 100) return `${ms.toFixed(1)}ms`;
  return `${Math.round(ms)}ms`;
}

export function WastedRenderReportView({ reports }: WastedRenderReportProps) {
  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">No wasted renders detected.</p>
        <p className="text-xs mt-1">Your components are rendering efficiently.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Wasted Renders ({reports.length} components)
        </h3>
      </div>

      <div className="flex flex-col gap-2">
        {reports.map((report) => {
          const severityStyle = SEVERITY_STYLES[report.severity];
          const actionStyle = ACTION_STYLES[report.recommendedAction] ?? ACTION_STYLES.none;

          return (
            <Card
              key={report.componentName}
              size="sm"
              className={cn('border-l-2', severityStyle.bg)}
            >
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-mono">
                    {report.componentName}
                  </CardTitle>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className={cn('text-[10px]', severityStyle.badge)}>
                      <span
                        className={cn(
                          'inline-block size-1.5 rounded-full mr-1',
                          severityStyle.dot,
                        )}
                      />
                      {report.severity}
                    </Badge>
                    <Badge variant="outline" className={cn('text-[10px]', actionStyle)}>
                      {report.recommendedAction}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3 text-xs mt-1">
                  <div>
                    <span className="text-muted-foreground">Total Renders</span>
                    <p className="font-medium text-foreground">{report.totalRenders}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Wasted</span>
                    <p className="font-medium text-foreground">{report.wastedRenders}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Waste Rate</span>
                    <p className="font-medium text-foreground">{report.wastedRenderRate}%</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Est. Savings</span>
                    <p className="font-medium text-foreground">
                      {formatSavings(report.estimatedSavingsMs)}
                    </p>
                  </div>
                </div>

                {report.issues.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-[10px] text-muted-foreground mb-1">Issues:</p>
                    <ul className="flex flex-col gap-0.5">
                      {report.issues.slice(0, 3).map((issue, idx) => (
                        <li key={idx} className="text-[11px] text-muted-foreground">
                          {issue.suggestion}
                        </li>
                      ))}
                      {report.issues.length > 3 && (
                        <li className="text-[10px] text-muted-foreground">
                          +{report.issues.length - 3} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
