/**
 * RenderCauseBadge — displays a small badge indicating what caused a render.
 */

import type { Severity } from '@/src/shared/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RenderCauseBadgeProps {
  cause: string;
  severity: Severity;
}

const CAUSE_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  'prop-change': {
    label: 'Prop Change',
    className: 'bg-blue-500/15 text-blue-700 border-blue-500/25 dark:text-blue-400',
  },
  'state-change': {
    label: 'State Change',
    className: 'bg-amber-500/15 text-amber-700 border-amber-500/25 dark:text-amber-400',
  },
  'context-change': {
    label: 'Context Change',
    className: 'bg-purple-500/15 text-purple-700 border-purple-500/25 dark:text-purple-400',
  },
  'parent-rerender': {
    label: 'Parent Re-render',
    className: 'bg-gray-500/15 text-gray-700 border-gray-500/25 dark:text-gray-400',
  },
  'prop-reference': {
    label: 'Prop Reference',
    className: 'bg-orange-500/15 text-orange-700 border-orange-500/25 dark:text-orange-400',
  },
  'inline-function': {
    label: 'Inline Function',
    className: 'bg-cyan-500/15 text-cyan-700 border-cyan-500/25 dark:text-cyan-400',
  },
  'inline-object': {
    label: 'Inline Object',
    className: 'bg-pink-500/15 text-pink-700 border-pink-500/25 dark:text-pink-400',
  },
  'inline-array': {
    label: 'Inline Array',
    className: 'bg-teal-500/15 text-teal-700 border-teal-500/25 dark:text-teal-400',
  },
};

const SEVERITY_CLASS: Record<Severity, string> = {
  critical: 'ring-1 ring-red-500/40',
  high: 'ring-1 ring-orange-500/30',
  medium: '',
  low: '',
};

export function RenderCauseBadge({ cause, severity }: RenderCauseBadgeProps) {
  const config = CAUSE_CONFIG[cause] ?? {
    label: cause,
    className: 'bg-muted text-muted-foreground',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] font-medium',
        config.className,
        SEVERITY_CLASS[severity],
      )}
    >
      {config.label}
    </Badge>
  );
}
