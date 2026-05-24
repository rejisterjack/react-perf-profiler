/**
 * TreeContextMenu — right-click context menu for tree nodes.
 * Provides quick actions: view analysis, open in editor, copy name, expand/collapse.
 */

import { useCallback } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BarChart3, FileCode, Copy, ChevronDown, ChevronRight } from 'lucide-react';

interface TreeContextMenuProps {
  componentName: string;
  sourceLocation?: { fileName: string | null; lineNumber: number | null } | null;
  hasChildren: boolean;
  isExpanded: boolean;
  onViewAnalysis: () => void;
  onOpenInEditor: () => void;
  onCopyName: () => void;
  onToggleExpand: () => void;
  children: React.ReactNode;
}

export function TreeContextMenu({
  componentName,
  sourceLocation,
  hasChildren,
  isExpanded,
  onViewAnalysis,
  onOpenInEditor,
  onCopyName,
  onToggleExpand,
  children,
}: TreeContextMenuProps) {
  const handleOpenInEditor = useCallback(() => {
    if (sourceLocation?.fileName) {
      const line = sourceLocation.lineNumber ?? 1;
      window.open(`vscode://file/${sourceLocation.fileName}:${line}`);
    }
  }, [sourceLocation]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onContextMenu={(e) => { e.preventDefault(); }}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={onViewAnalysis} className="gap-2 text-xs">
          <BarChart3 className="size-3.5" />
          View Analysis
        </DropdownMenuItem>
        {sourceLocation?.fileName && (
          <DropdownMenuItem onClick={handleOpenInEditor} className="gap-2 text-xs">
            <FileCode className="size-3.5" />
            Open in Editor
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onCopyName} className="gap-2 text-xs">
          <Copy className="size-3.5" />
          Copy Component Name
        </DropdownMenuItem>
        {hasChildren && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleExpand} className="gap-2 text-xs">
              {isExpanded ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              {isExpanded ? 'Collapse Children' : 'Expand Children'}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
