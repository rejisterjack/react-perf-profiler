/**
 * PanelLayout Component
 * Main 3-panel layout with resizable sidebar and detail panel
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';
import { DetailPanel } from './DetailPanel';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import styles from './PanelLayout.module.css';

type ResizeTarget = 'sidebar' | 'detail';

// =============================================================================
// Component
// =============================================================================

export const PanelLayout: React.FC = () => {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { sidebarWidth, detailPanelOpen, detailPanelWidth, setSidebarWidth, setDetailPanelWidth } = useProfilerStore();
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [activeResizer, setActiveResizer] = useState<ResizeTarget | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // =============================================================================
  // Resize Handlers
  // =============================================================================

  const handleSidebarResize = useCallback((newWidth: number) => {
    setSidebarWidth(Math.max(200, Math.min(500, newWidth)));
  }, [setSidebarWidth]);

  const handleDetailPanelResize = useCallback((newWidth: number) => {
    setDetailPanelWidth?.(Math.max(250, Math.min(600, newWidth)));
  }, [setDetailPanelWidth]);

  const startResize = useCallback((e: React.MouseEvent, target: ResizeTarget) => {
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
  }, [sidebarWidth, detailPanelWidth]);

  const stopResize = useCallback(() => {
    setIsResizing(false);
    setActiveResizer(null);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !activeResizer) return;

    const delta = e.clientX - resizeStartX.current;

    if (activeResizer === 'sidebar') {
      handleSidebarResize(resizeStartWidth.current + delta);
    } else if (activeResizer === 'detail') {
      // For detail panel, dragging left increases width
      handleDetailPanelResize(resizeStartWidth.current - delta);
    }
  }, [isResizing, activeResizer, handleSidebarResize, handleDetailPanelResize]);

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
      
      const touch = e.touches[0];
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
    <div 
      ref={containerRef}
      className={styles.panelLayout}
      data-resizing={isResizing}
    >
      {/* Left sidebar - Component tree */}
      <Sidebar 
        ref={sidebarRef}
        width={sidebarWidth}
        onResize={handleSidebarResize}
      />
      
      {/* Resizer handle for sidebar */}
      <div 
        className={`${styles.resizer} ${activeResizer === 'sidebar' ? styles.active : ''}`}
        onMouseDown={(e) => startResize(e, 'sidebar')}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          startResize(
            { clientX: touch.clientX, preventDefault: () => e.preventDefault() } as React.MouseEvent,
            'sidebar'
          );
        }}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        tabIndex={0}
        onKeyDown={(e) => {
          // Keyboard accessibility for resizing
          const step = e.shiftKey ? 20 : 5;
          if (e.key === 'ArrowRight') {
            handleSidebarResize(sidebarWidth + step);
          } else if (e.key === 'ArrowLeft') {
            handleSidebarResize(sidebarWidth - step);
          }
        }}
      />
      
      {/* Main content area */}
      <MainContent className={styles.mainContent} />
      
      {/* Right detail panel */}
      {detailPanelOpen && (
        <>
          {/* Resizer handle for detail panel */}
          <div 
            className={`${styles.resizer} ${activeResizer === 'detail' ? styles.active : ''}`}
            onMouseDown={(e) => startResize(e, 'detail')}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              startResize(
                { clientX: touch.clientX, preventDefault: () => e.preventDefault() } as React.MouseEvent,
                'detail'
              );
            }}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize detail panel"
            tabIndex={0}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 20 : 5;
              if (e.key === 'ArrowLeft') {
                handleDetailPanelResize((detailPanelWidth || 320) + step);
              } else if (e.key === 'ArrowRight') {
                handleDetailPanelResize((detailPanelWidth || 320) - step);
              }
            }}
          />
          <DetailPanel ref={detailPanelRef} />
        </>
      )}
      
      {/* Resize overlay to prevent iframe/content issues during resize */}
      {isResizing && (
        <div className={styles.resizeOverlay} aria-hidden="true" />
      )}
    </div>
  );
};

export default PanelLayout;
