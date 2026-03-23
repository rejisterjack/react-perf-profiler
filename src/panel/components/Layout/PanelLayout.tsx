/**
 * PanelLayout Component
 * Main 3-panel layout with resizable sidebar and detail panel
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { ErrorBoundary } from '../ErrorBoundary';
import { BudgetAlertBanner } from './BudgetAlertBanner';
import { DetailPanel } from './DetailPanel';
import { MainContent } from './MainContent';
import styles from './PanelLayout.module.css';
import { Sidebar } from './Sidebar';
import { TimeTravelControls } from './TimeTravelControls';

type ResizeTarget = 'sidebar' | 'detail';

// =============================================================================
// Component
// =============================================================================

export const PanelLayout: React.FC = () => {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { sidebarWidth, detailPanelOpen, detailPanelWidth, setSidebarWidth, setDetailPanelWidth } =
    useProfilerStore();

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [activeResizer, setActiveResizer] = useState<ResizeTarget | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // =============================================================================
  // Resize Handlers
  // =============================================================================

  const handleSidebarResize = useCallback(
    (newWidth: number) => {
      setSidebarWidth(Math.max(200, Math.min(500, newWidth)));
    },
    [setSidebarWidth]
  );

  const handleDetailPanelResize = useCallback(
    (newWidth: number) => {
      setDetailPanelWidth?.(Math.max(250, Math.min(600, newWidth)));
    },
    [setDetailPanelWidth]
  );

  const startResize = useCallback(
    (e: React.MouseEvent, target: ResizeTarget) => {
      e.preventDefault();
      setIsResizing(true);
      setActiveResizer(target);
      resizeStartX.current = e.clientX;

      if (target === 'sidebar') {
        resizeStartWidth.current = sidebarWidth;
      } else {
        resizeStartWidth.current = detailPanelWidth || 320;
      }

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [sidebarWidth, detailPanelWidth]
  );

  const stopResize = useCallback(() => {
    setIsResizing(false);
    setActiveResizer(null);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !activeResizer) return;

      const delta = e.clientX - resizeStartX.current;

      if (activeResizer === 'sidebar') {
        handleSidebarResize(resizeStartWidth.current + delta);
      } else if (activeResizer === 'detail') {
        // For detail panel, dragging left increases width
        handleDetailPanelResize(resizeStartWidth.current - delta);
      }
    },
    [isResizing, activeResizer, handleSidebarResize, handleDetailPanelResize]
  );

  // =============================================================================
  // Effects
  // =============================================================================

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopResize);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [isResizing, handleMouseMove, stopResize]);

  // Handle touch events for mobile/tablet
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!isResizing || !activeResizer) return;
      e.preventDefault();

      const touch = e.touches[0]!;
      const delta = touch.clientX - resizeStartX.current;

      if (activeResizer === 'sidebar') {
        handleSidebarResize(resizeStartWidth.current + delta);
      } else if (activeResizer === 'detail') {
        handleDetailPanelResize(resizeStartWidth.current - delta);
      }
    };

    const handleTouchEnd = () => {
      stopResize();
    };

    if (isResizing) {
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isResizing, activeResizer, handleSidebarResize, handleDetailPanelResize, stopResize]);

  return (
    <div ref={containerRef} className={styles['panelLayout']} data-resizing={isResizing}>
      {/* Budget violation alerts — spans full width, shown only when violations exist */}
      <ErrorBoundary context="budget alerts" compact>
        <BudgetAlertBanner />
      </ErrorBoundary>

      {/* Time travel scrubber — spans full width above the 3-panel area */}
      <div className={styles['timeTravelRow']}>
        <ErrorBoundary context="time travel controls" compact>
          <TimeTravelControls />
        </ErrorBoundary>
      </div>

      {/* Three-panel row: sidebar | main | detail */}
      <div className={styles['panelRow']}>
        {/* Left sidebar - Component tree */}
        <ErrorBoundary context="component tree view">
          <Sidebar ref={sidebarRef} width={sidebarWidth} onResize={handleSidebarResize} />
        </ErrorBoundary>

        {/* Resizer handle for sidebar */}
        <button
          type="button"
          aria-label="Resize sidebar"
          className={`${styles['resizer']} ${activeResizer === 'sidebar' ? styles['active'] : ''}`}
          onMouseDown={(e) => startResize(e, 'sidebar')}
          onTouchStart={(e) => {
            const touch = e.touches[0]!;
            startResize(
              {
                clientX: touch.clientX,
                preventDefault: () => e.preventDefault(),
              } as React.MouseEvent,
              'sidebar'
            );
          }}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 20 : 5;
            if (e.key === 'ArrowRight') {
              handleSidebarResize(sidebarWidth + step);
            } else if (e.key === 'ArrowLeft') {
              handleSidebarResize(sidebarWidth - step);
            }
          }}
        />

        {/* Main content area */}
        <ErrorBoundary context="main content view">
          <MainContent className={styles['mainContent']} />
        </ErrorBoundary>

        {/* Right detail panel */}
        {detailPanelOpen && (
          <>
            {/* Resizer handle for detail panel */}
            <button
              type="button"
              aria-label="Resize detail panel"
              className={`${styles['resizer']} ${activeResizer === 'detail' ? styles['active'] : ''}`}
              onMouseDown={(e) => startResize(e, 'detail')}
              onTouchStart={(e) => {
                const touch = e.touches[0]!;
                startResize(
                  {
                    clientX: touch.clientX,
                    preventDefault: () => e.preventDefault(),
                  } as React.MouseEvent,
                  'detail'
                );
              }}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 20 : 5;
                if (e.key === 'ArrowLeft') {
                  handleDetailPanelResize((detailPanelWidth || 320) + step);
                } else if (e.key === 'ArrowRight') {
                  handleDetailPanelResize((detailPanelWidth || 320) - step);
                }
              }}
            />
            <ErrorBoundary context="detail panel">
              <DetailPanel ref={detailPanelRef} />
            </ErrorBoundary>
          </>
        )}

        {/* Resize overlay to prevent iframe/content issues during resize */}
        {isResizing && <div className={styles['resizeOverlay']} aria-hidden="true" />}
      </div>
    </div>
  );
};

export default PanelLayout;
