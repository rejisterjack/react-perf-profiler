import { useRef, useState, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface PanelLayoutProps {
  sidebar: React.ReactNode
  children: React.ReactNode
  detailPanel?: React.ReactNode
  defaultSidebarWidth?: number
  defaultDetailWidth?: number
}

const COMPACT_BREAKPOINT = 600

function Divider({
  orientation,
  onDrag,
}: {
  orientation: 'vertical' | 'horizontal'
  onDrag: (e: React.MouseEvent) => void
}) {
  return (
    <div
      role='separator'
      aria-orientation={orientation}
      className={cn(
        'group relative shrink-0',
        orientation === 'vertical'
          ? 'w-px cursor-col-resize bg-border hover:bg-primary/60 active:bg-primary'
          : 'h-px cursor-row-resize bg-border hover:bg-primary/60 active:bg-primary'
      )}
      onMouseDown={onDrag}
    >
      <div
        className={cn(
          'absolute z-10 transition-colors',
          orientation === 'vertical'
            ? 'inset-y-0 -left-1 -right-1'
            : 'inset-x-0 -top-1 -bottom-1'
        )}
      />
    </div>
  )
}

export function PanelLayout({
  sidebar,
  children,
  detailPanel,
  defaultSidebarWidth = 280,
  defaultDetailWidth = 400,
}: PanelLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(defaultSidebarWidth)
  const [detailWidth, setDetailWidth] = useState(defaultDetailWidth)
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isCompact, setIsCompact] = useState(false)

  // Responsive breakpoint detection
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsCompact(entry.contentRect.width < COMPACT_BREAKPOINT)
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // In compact mode, open detail panel as sheet when there's content
  useEffect(() => {
    setIsDetailSheetOpen(isCompact && !!detailPanel)
  }, [isCompact, detailPanel])

  const handleSidebarDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = sidebarWidth

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!containerRef.current) return
        const delta = moveEvent.clientX - startX
        const newWidth = Math.max(180, Math.min(500, startWidth + delta))
        setSidebarWidth(newWidth)
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [sidebarWidth]
  )

  const handleDetailDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = detailWidth

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!containerRef.current) return
        const delta = startX - moveEvent.clientX
        const newWidth = Math.max(250, Math.min(600, startWidth + delta))
        setDetailWidth(newWidth)
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [detailWidth]
  )

  // Compact mode: sidebar as icon-only strip, detail as sheet overlay
  if (isCompact) {
    return (
      <div
        ref={containerRef}
        className='flex h-full w-full overflow-hidden bg-background'
      >
        {/* Compact sidebar — icon-only strip */}
        <div className='shrink-0 w-12 overflow-y-auto border-r border-border'>
          {sidebar}
        </div>

        {/* Main content */}
        <div className='flex-1 overflow-hidden'>{children}</div>

        {/* Detail panel as Sheet in compact mode */}
        {detailPanel && (
          <Sheet open={isDetailSheetOpen} onOpenChange={setIsDetailSheetOpen}>
            <SheetContent side='right' className='w-[400px] p-0 overflow-y-auto'>
              <SheetHeader className='sr-only'>
                <SheetTitle>Component Details</SheetTitle>
              </SheetHeader>
              {detailPanel}
            </SheetContent>
          </Sheet>
        )}
      </div>
    )
  }

  // Full mode
  return (
    <div
      ref={containerRef}
      className='flex h-full w-full overflow-hidden bg-background'
    >
      <div
        className='shrink-0 overflow-y-auto border-r border-border'
        style={{ width: sidebarWidth }}
      >
        {sidebar}
      </div>

      <Divider orientation='vertical' onDrag={handleSidebarDrag} />

      <div className='flex-1 overflow-hidden'>{children}</div>

      {detailPanel && (
        <>
          <Divider orientation='vertical' onDrag={handleDetailDrag} />
          <div
            className='shrink-0 overflow-y-auto border-l border-border'
            style={{ width: detailWidth }}
          >
            {detailPanel}
          </div>
        </>
      )}
    </div>
  )
}
