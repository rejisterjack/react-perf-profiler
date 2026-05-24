import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface TreeSearchProps {
  value: string
  onChange: (value: string) => void
}

export function TreeSearch({ value, onChange }: TreeSearchProps) {
  return (
    <div className="relative flex items-center">
      <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search components..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 pl-7 pr-7 text-xs"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "absolute right-2 flex size-4 items-center justify-center rounded-sm",
            "text-muted-foreground hover:text-foreground"
          )}
          aria-label="Clear search"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}
