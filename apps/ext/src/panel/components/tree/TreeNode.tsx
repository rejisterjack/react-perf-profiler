import { ChevronRight, Hash, Sparkles, AlertTriangle } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface TreeNodeProps {
  name: string
  duration: number
  renderCount: number
  isMemoized: boolean
  wasteRate: number
  isExpanded: boolean
  hasChildren: boolean
  depth: number
  onToggle: () => void
  onSelect: () => void
  isSelected: boolean
  children?: React.ReactNode
}

function DurationBadge({ duration }: { duration: number }) {
  if (duration > 16) {
    return (
      <Badge variant="destructive" className="h-4 gap-0.5 px-1 text-[10px]">
        {duration.toFixed(1)}ms
      </Badge>
    )
  }
  if (duration > 8) {
    return (
      <Badge className="h-4 gap-0.5 bg-yellow-500/15 px-1 text-[10px] text-yellow-600 hover:bg-yellow-500/25 dark:text-yellow-400">
        {duration.toFixed(1)}ms
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="h-4 gap-0.5 px-1 text-[10px]">
      {duration.toFixed(1)}ms
    </Badge>
  )
}

export function TreeNode({
  name,
  duration,
  renderCount,
  isMemoized,
  wasteRate,
  isExpanded,
  hasChildren,
  depth,
  onToggle,
  onSelect,
  isSelected,
  children,
}: TreeNodeProps) {
  const hasWaste = wasteRate > 30;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onSelect()
          }
        }}
        className={cn(
          "flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 text-xs",
          "hover:bg-muted/50",
          isSelected && "bg-accent text-accent-foreground",
          !isSelected && hasWaste && wasteRate > 80 && "bg-red-500/5 border-l-2 border-l-red-500/60",
          !isSelected && hasWaste && wasteRate > 40 && wasteRate <= 80 && "bg-yellow-500/5 border-l-2 border-l-yellow-500/60",
          !isSelected && hasWaste && wasteRate <= 40 && "bg-orange-500/5 border-l-2 border-l-orange-500/40",
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {hasChildren ? (
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-muted"
              aria-label={isExpanded ? "Collapse" : "Expand"}
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
            >
              <ChevronRight
                className={cn(
                  "size-3 text-muted-foreground transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
            </button>
          </CollapsibleTrigger>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <span className="truncate font-medium">{name}</span>

        {isMemoized && (
          <Sparkles className="size-3 shrink-0 text-blue-500" aria-label="Memoized" />
        )}

        {hasWaste && (
          <AlertTriangle
            className={cn(
              "size-3 shrink-0",
              wasteRate > 80 ? "text-red-500" : wasteRate > 40 ? "text-yellow-500" : "text-orange-500"
            )}
            aria-label={`${wasteRate}% wasted renders`}
          />
        )}

        <DurationBadge duration={duration} />

        {renderCount > 0 && (
          <span className="ml-auto flex shrink-0 items-center gap-0.5 text-muted-foreground">
            <Hash className="size-2.5" />
            <span className="text-[10px] tabular-nums">{renderCount}</span>
          </span>
        )}
      </div>

      {hasChildren && (
        <CollapsibleContent className="relative">
          {children}
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}
