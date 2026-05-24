import {
  Activity,
  Circle,
  Settings,
  TreePine,
  Flame,
  Clock,
  BarChart3,
  AlertTriangle,
  Gauge,
  GitCompare,
  Network,
} from "lucide-react"
import { ThemeToggle } from "@/src/panel/components/theme/ThemeToggle"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

export type ViewMode = "tree" | "flamegraph" | "timeline" | "analysis" | "vitals" | "compare" | "dependencies"
export type ConnectionState = "connected" | "disconnected" | "connecting"

interface ToolbarProps {
  isRecording: boolean
  onToggleRecording: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  connectionState: ConnectionState
  wastedRenderCount?: number
  criticalCount?: number
  performanceScore?: number | null
  budgetViolations?: number
  onOpenSettings?: () => void
}

const VIEW_MODE_ITEMS: { value: ViewMode; label: string; icon: React.ElementType }[] = [
  { value: "tree", label: "Tree", icon: TreePine },
  { value: "flamegraph", label: "Flame", icon: Flame },
  { value: "timeline", label: "Timeline", icon: Clock },
  { value: "analysis", label: "Analysis", icon: BarChart3 },
  { value: "vitals", label: "Vitals", icon: Gauge },
  { value: "compare", label: "Compare", icon: GitCompare },
  { value: "dependencies", label: "Deps", icon: Network },
]

export function Toolbar({
  isRecording,
  onToggleRecording,
  viewMode,
  onViewModeChange,
  connectionState,
  wastedRenderCount = 0,
  criticalCount = 0,
  performanceScore = null,
  budgetViolations = 0,
  onOpenSettings,
}: ToolbarProps) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-primary" />
        <span className="text-sm font-medium">React Perf Profiler</span>
      </div>

      <Badge
        variant={connectionState === "connected" ? "default" : "secondary"}
        className={cn(
          "gap-1",
          connectionState === "connected" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
          connectionState === "connecting" && "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
        )}
      >
        <Circle
          className={cn(
            "size-2 fill-current",
            connectionState === "connected" && "text-emerald-500",
            connectionState === "connecting" && "animate-pulse text-yellow-500",
            connectionState === "disconnected" && "text-muted-foreground"
          )}
        />
        {connectionState === "connected"
          ? "Connected"
          : connectionState === "connecting"
            ? "Connecting"
            : "Disconnected"}
      </Badge>

      {performanceScore != null && (
        <Badge
          variant="outline"
          className={cn(
            "gap-1 cursor-pointer tabular-nums",
            performanceScore >= 80 && "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400",
            performanceScore >= 60 && performanceScore < 80 && "bg-yellow-500/15 text-yellow-600 border-yellow-500/30 dark:text-yellow-400",
            performanceScore < 60 && "bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400"
          )}
          onClick={() => onViewModeChange("analysis")}
        >
          Score: {performanceScore}
        </Badge>
      )}

      {wastedRenderCount > 0 && (
        <Badge
          variant="outline"
          className={cn(
            "gap-1 cursor-pointer",
            criticalCount > 0
              ? "bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400"
              : "bg-yellow-500/15 text-yellow-600 border-yellow-500/30 dark:text-yellow-400"
          )}
          onClick={() => onViewModeChange("analysis")}
        >
          <AlertTriangle className="size-3" />
          {wastedRenderCount} wasted
          {criticalCount > 0 && (
            <span className="text-[10px] opacity-75">({criticalCount} critical)</span>
          )}
        </Badge>
      )}

      {budgetViolations > 0 && (
        <Badge
          variant="outline"
          className="gap-1 bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400"
        >
          <AlertTriangle className="size-3" />
          {budgetViolations} budget violation{budgetViolations !== 1 ? 's' : ''}
        </Badge>
      )}

      <div className="mx-2 h-4 w-px bg-border" />

      <Button
        variant={isRecording ? "destructive" : "default"}
        size="sm"
        onClick={onToggleRecording}
        className={cn("gap-1.5", !isRecording && "bg-red-500 hover:bg-red-600 text-white")}
      >
        <Circle
          className={cn(
            "size-2.5",
            isRecording ? "fill-current" : "fill-current"
          )}
        />
        {isRecording ? "Stop" : "Record"}
      </Button>

      <div className="mx-2 h-4 w-px bg-border" />

      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(value) => {
          if (value) onViewModeChange(value as ViewMode)
        }}
        variant="outline"
        size="sm"
      >
        {VIEW_MODE_ITEMS.map(({ value, label, icon: Icon }) => (
          <ToggleGroupItem key={value} value={value} aria-label={label}>
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="flex-1" />

      <ThemeToggle />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Settings"
        onClick={onOpenSettings}
      >
        <Settings className="size-4" />
      </Button>
    </div>
  )
}
