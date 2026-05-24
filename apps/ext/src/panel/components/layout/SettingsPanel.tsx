/**
 * SettingsPanel — a Sheet-based settings panel for the profiler.
 */

import { useState } from 'react';
import { Settings, RotateCcw, X } from 'lucide-react';
import { useSettingsStore } from '@/src/panel/stores/settingsStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="pt-4 pb-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
        {title}
      </p>
    </div>
  );
}

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const settings = useSettingsStore();
  const { updateSetting, resetSettings } = settings;
  const [confirmReset, setConfirmReset] = useState(false);

  function handleReset() {
    if (confirmReset) {
      resetSettings();
      setConfirmReset(false);
    } else {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[340px] sm:w-[400px] p-0 flex flex-col overflow-hidden"
      >
        <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="size-4 text-primary" />
              <SheetTitle className="text-sm">Settings</SheetTitle>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              aria-label="Close settings"
            >
              <X className="size-4" />
            </Button>
          </div>
          <SheetDescription className="text-xs">
            Configure the React Performance Profiler
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Recording */}
          <SectionHeader title="Recording" />
          <Separator className="mb-1" />

          <SettingRow
            label="Max Commits"
            description="Maximum number of commits to keep in memory"
          >
            <Select
              value={String(settings.maxCommits)}
              onValueChange={(v) => updateSetting('maxCommits', Number(v))}
            >
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[100, 250, 500, 1000, 2000].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow
            label="Auto-start Profiling"
            description="Automatically start profiling when React is detected"
          >
            <Switch
              checked={settings.autoStartProfiling}
              onCheckedChange={(v) => updateSetting('autoStartProfiling', v)}
            />
          </SettingRow>

          <SettingRow
            label="Incremental Diffing"
            description="Send delta commits instead of full fiber trees"
          >
            <Switch
              checked={settings.incrementalDiffing}
              onCheckedChange={(v) => updateSetting('incrementalDiffing', v)}
            />
          </SettingRow>

          <SettingRow
            label="Enable Time Travel"
            description="Allow stepping through commits one by one"
          >
            <Switch
              checked={settings.enableTimeTravel}
              onCheckedChange={(v) => updateSetting('enableTimeTravel', v)}
            />
          </SettingRow>

          {/* Analysis */}
          <SectionHeader title="Analysis" />
          <Separator className="mb-1" />

          <SettingRow
            label="Render Cause Tracking"
            description="Track what caused each component to re-render"
          >
            <Switch
              checked={settings.renderCauseTracking}
              onCheckedChange={(v) => updateSetting('renderCauseTracking', v)}
            />
          </SettingRow>

          <SettingRow
            label="Source Correlation"
            description="Map components to source file locations"
          >
            <Switch
              checked={settings.sourceCorrelation}
              onCheckedChange={(v) => updateSetting('sourceCorrelation', v)}
            />
          </SettingRow>

          <SettingRow
            label="Wasted Render Threshold"
            description="Minimum wasted render rate to flag (0–100%)"
          >
            <Select
              value={String(settings.wastedRenderThreshold)}
              onValueChange={(v) => updateSetting('wastedRenderThreshold', Number(v))}
            >
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0.05, 0.1, 0.2, 0.3, 0.5].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">
                    {Math.round(n * 100)}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow
            label="Memo Hit Rate Threshold"
            description="Minimum memo hit rate to flag as effective (0–100%)"
          >
            <Select
              value={String(settings.memoHitRateThreshold)}
              onValueChange={(v) => updateSetting('memoHitRateThreshold', Number(v))}
            >
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0.5, 0.6, 0.7, 0.8, 0.9].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">
                    {Math.round(n * 100)}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          {/* Props Inspection */}
          <SectionHeader title="Props Inspection" />
          <Separator className="mb-1" />

          <SettingRow
            label="Max Prop Depth"
            description="Maximum depth to traverse object props"
          >
            <Select
              value={String(settings.maxPropDepth)}
              onValueChange={(v) => updateSetting('maxPropDepth', Number(v))}
            >
              <SelectTrigger className="h-7 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow
            label="Max Prop Keys"
            description="Maximum number of prop keys to capture per component"
          >
            <Select
              value={String(settings.maxPropKeys)}
              onValueChange={(v) => updateSetting('maxPropKeys', Number(v))}
            >
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 30, 50].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          {/* UI */}
          <SectionHeader title="Interface" />
          <Separator className="mb-1" />

          <SettingRow
            label="Show Notifications"
            description="Show toast notifications for events"
          >
            <Switch
              checked={settings.showNotifications}
              onCheckedChange={(v) => updateSetting('showNotifications', v)}
            />
          </SettingRow>

          <SettingRow
            label="Compact Mode"
            description="Reduce visual density of the UI"
          >
            <Select
              value={settings.compactMode}
              onValueChange={(v) => updateSetting('compactMode', v as 'auto' | 'always' | 'never')}
            >
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto" className="text-xs">Auto</SelectItem>
                <SelectItem value="always" className="text-xs">Always</SelectItem>
                <SelectItem value="never" className="text-xs">Never</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow
            label="Editor Protocol"
            description="Protocol used to open source files in your editor"
          >
            <Select
              value={settings.editorProtocol}
              onValueChange={(v) => updateSetting('editorProtocol', v as 'vscode' | 'cursor' | 'custom')}
            >
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vscode" className="text-xs">VS Code</SelectItem>
                <SelectItem value="cursor" className="text-xs">Cursor</SelectItem>
                <SelectItem value="custom" className="text-xs">Custom</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          {/* Reset */}
          <div className="pt-6 pb-2">
            <Button
              variant={confirmReset ? 'destructive' : 'outline'}
              size="sm"
              onClick={handleReset}
              className="w-full gap-2"
            >
              <RotateCcw className="size-3.5" />
              {confirmReset ? 'Click again to confirm reset' : 'Reset to Defaults'}
            </Button>
          </div>

          {/* Version */}
          <div className="flex items-center justify-center pt-2">
            <Badge variant="outline" className="text-[10px] text-muted-foreground/60">
              React Perf Profiler v1.0.0
            </Badge>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
