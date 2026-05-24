/**
 * SmartRecordingPanel — configure targeted recording modes.
 * Supports: record by component, record slow only, record next interaction.
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Filter, Zap, Target, Clock, Crosshair } from 'lucide-react';

type FilterType = 'component' | 'duration' | 'interaction';

interface RecordingFilter {
  type: FilterType;
  value: unknown;
  label: string;
}

interface SmartRecordingPanelProps {
  onApplyFilters: (filters: Array<{ type: string; value: unknown }>) => void;
  onClearFilters: () => void;
  activeFilters: RecordingFilter[];
}

export function SmartRecordingPanel({ onApplyFilters, onClearFilters, activeFilters }: SmartRecordingPanelProps) {
  const [mode, setMode] = useState<FilterType | null>(null);
  const [componentName, setComponentName] = useState('');
  const [minDuration, setMinDuration] = useState('5');
  const [interactionBudget, setInteractionBudget] = useState('20');

  const handleApply = useCallback(() => {
    const filters: Array<{ type: string; value: unknown }> = [];

    if (mode === 'component' && componentName.trim()) {
      filters.push({ type: 'component', value: componentName.trim() });
    } else if (mode === 'duration') {
      filters.push({ type: 'duration', value: parseFloat(minDuration) || 5 });
    } else if (mode === 'interaction') {
      filters.push({ type: 'interaction', value: parseInt(interactionBudget, 10) || 20 });
    }

    if (filters.length > 0) {
      onApplyFilters(filters);
    }
  }, [mode, componentName, minDuration, interactionBudget, onApplyFilters]);

  const modes: Array<{ type: FilterType; icon: React.ElementType; label: string; description: string }> = [
    { type: 'component', icon: Target, label: 'By Component', description: 'Only capture commits touching a specific component' },
    { type: 'duration', icon: Clock, label: 'Slow Only', description: 'Only capture commits above a duration threshold' },
    { type: 'interaction', icon: Crosshair, label: 'Next Interaction', description: 'Capture commits from the next user interaction' },
  ];

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-primary" />
          <h3 className="text-sm font-medium">Smart Recording</h3>
          {activeFilters.length > 0 && (
            <Badge variant="outline" className="bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400 text-[10px]">
              {activeFilters.length} filter{activeFilters.length !== 1 ? 's' : ''} active
            </Badge>
          )}
        </div>

        {activeFilters.length > 0 && (
          <Card>
            <CardContent className="flex items-center gap-2 flex-wrap py-3">
              {activeFilters.map((f, idx) => (
                <Badge key={idx} variant="outline" className="text-[10px] gap-1">
                  {f.type === 'component' && <Target className="size-2.5" />}
                  {f.type === 'duration' && <Clock className="size-2.5" />}
                  {f.type === 'interaction' && <Crosshair className="size-2.5" />}
                  {f.label}
                </Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-[10px] h-5 ml-auto">
                Clear
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Mode selection */}
        <div className="flex flex-col gap-2">
          {modes.map(({ type, icon: Icon, label, description }) => (
            <Card
              key={type}
              className={cn(
                'cursor-pointer transition-colors hover:bg-muted/50',
                mode === type && 'ring-1 ring-primary bg-primary/5'
              )}
              onClick={() => setMode(mode === type ? null : type)}
            >
              <CardContent className="flex items-center gap-3 py-3">
                <Icon className={cn('size-4', mode === type ? 'text-primary' : 'text-muted-foreground')} />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Mode-specific config */}
        {mode === 'component' && (
          <Card>
            <CardContent className="flex flex-col gap-2 py-3">
              <label className="text-xs text-muted-foreground">Component name (exact match)</label>
              <Input
                placeholder="e.g., DashboardPanel"
                value={componentName}
                onChange={(e) => setComponentName(e.target.value)}
              />
            </CardContent>
          </Card>
        )}

        {mode === 'duration' && (
          <Card>
            <CardContent className="flex flex-col gap-2 py-3">
              <label className="text-xs text-muted-foreground">Minimum commit duration (ms)</label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={minDuration}
                onChange={(e) => setMinDuration(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Only commits with duration above this threshold will be recorded</p>
            </CardContent>
          </Card>
        )}

        {mode === 'interaction' && (
          <Card>
            <CardContent className="flex flex-col gap-2 py-3">
              <label className="text-xs text-muted-foreground">Max commits to capture per interaction</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={interactionBudget}
                onChange={(e) => setInteractionBudget(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Recording starts on the next click, input, keydown, or scroll event</p>
            </CardContent>
          </Card>
        )}

        {/* Apply button */}
        {mode && (
          <Button onClick={handleApply} className="gap-1.5">
            <Zap className="size-3.5" />
            Apply Filter & Start Recording
          </Button>
        )}
      </div>
    </ScrollArea>
  );
}
