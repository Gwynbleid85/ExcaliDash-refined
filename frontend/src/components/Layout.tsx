import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Logo } from './Logo';
import { UploadStatus } from './UploadStatus';
import { ImpersonationBanner } from './ImpersonationBanner';
import { UpdateBanner } from './UpdateBanner';
import type { Collection } from '../types';
import clsx from 'clsx';

interface LayoutProps {
  children: React.ReactNode;
  collections: Collection[];
  selectedCollectionId: string | null | undefined;
  onSelectCollection: (id: string | null | undefined) => void;
  onCreateCollection: (name: string) => void;
  onEditCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onDrop?: (e: React.DragEvent, collectionId: string | null) => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  collections,
  selectedCollectionId,
  onSelectCollection,
  onCreateCollection,
  onEditCollection,
  onDeleteCollection,
  onDrop
}) => {
  const location = useLocation();
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const resizeMouseMoveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const resizeMouseUpHandlerRef = useRef<(() => void) | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;

    if (resizeMouseMoveHandlerRef.current) {
      document.removeEventListener('mousemove', resizeMouseMoveHandlerRef.current);
    }
    if (resizeMouseUpHandlerRef.current) {
      document.removeEventListener('mouseup', resizeMouseUpHandlerRef.current);
    }

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(200, Math.min(600, startWidthRef.current + diff));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      resizeMouseMoveHandlerRef.current = null;
      resizeMouseUpHandlerRef.current = null;
    };

    resizeMouseMoveHandlerRef.current = handleMouseMove;
    resizeMouseUpHandlerRef.current = handleMouseUp;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    return () => {
      if (resizeMouseMoveHandlerRef.current) {
        document.removeEventListener('mousemove', resizeMouseMoveHandlerRef.current);
        resizeMouseMoveHandlerRef.current = null;
      }
      if (resizeMouseUpHandlerRef.current) {
        document.removeEventListener('mouseup', resizeMouseUpHandlerRef.current);
        resizeMouseUpHandlerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const sync = () => {
      setIsMobile(mq.matches);
      setIsSidebarOpen(!mq.matches);
    };

    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    setIsSidebarOpen(false);
  }, [isMobile, location.pathname, location.search]);

  return (
    <div className="h-screen w-full bg-ex-bg p-2 sm:p-4 transition-colors duration-200 overflow-hidden">
      {isMobile ? (
        <div className="relative h-full min-w-0">
          <main className="h-full min-w-0 ex-island overflow-hidden flex flex-col">
            <div className="h-16 flex-shrink-0 flex items-center px-4 border-b border-ex-divider">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(v => !v)}
                className="ex-btn-icon"
                title={isSidebarOpen ? 'Close menu' : 'Open menu'}
                aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
              >
                {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              <div className="ml-auto flex items-center gap-2">
                <Logo className="w-8 h-8" />
                <span className="ex-brand text-xl mt-1">ExcaliDash</span>
                <span className="text-[10px] font-bold text-ex-danger mt-2">BETA</span>
              </div>
            </div>

            <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
              <div className="w-full mx-auto p-4 sm:p-6 lg:p-8 min-h-full">
                <UpdateBanner />
                <ImpersonationBanner />
                {children}
              </div>
            </div>
          </main>

          <div
            className={clsx(
              'fixed inset-0 z-30 bg-black/30 backdrop-blur-sm transition-opacity duration-150',
              isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
            onClick={() => setIsSidebarOpen(false)}
          />

          <aside
            ref={sidebarRef}
            className={clsx(
              'fixed inset-y-4 left-2 sm:left-4 z-40 ex-island overflow-hidden transition-transform duration-200',
              isSidebarOpen ? 'translate-x-0' : '-translate-x-[110%]'
            )}
            style={{ width: `${sidebarWidth}px` }}
          >
            <Sidebar
              collections={collections}
              selectedCollectionId={selectedCollectionId}
              onSelectCollection={onSelectCollection}
              onCreateCollection={onCreateCollection}
              onEditCollection={onEditCollection}
              onDeleteCollection={onDeleteCollection}
              onDrop={onDrop}
            />

            <div
              className={clsx(
                'absolute top-0 right-0 w-1.5 h-full cursor-col-resize bg-transparent hover:bg-ex-primary/30 transition-colors duration-150',
                isResizing && 'bg-ex-primary/40 w-2'
              )}
              onMouseDown={handleMouseDown}
              title="Drag to resize sidebar"
            />
          </aside>
        </div>
      ) : (
        <div className="flex gap-3 sm:gap-4 items-start h-full min-w-0">
          <aside
            ref={sidebarRef}
            className="flex-shrink-0 h-full ex-island overflow-hidden relative"
            style={{ width: `${sidebarWidth}px` }}
          >
            <Sidebar
              collections={collections}
              selectedCollectionId={selectedCollectionId}
              onSelectCollection={onSelectCollection}
              onCreateCollection={onCreateCollection}
              onEditCollection={onEditCollection}
              onDeleteCollection={onDeleteCollection}
              onDrop={onDrop}
            />

            <div
              className={clsx(
                'absolute top-0 right-0 w-1.5 h-full cursor-col-resize bg-transparent hover:bg-ex-primary/30 transition-colors duration-150',
                isResizing && 'bg-ex-primary/40 w-2'
              )}
              onMouseDown={handleMouseDown}
              title="Drag to resize sidebar"
            />
          </aside>
          <main className="flex-1 min-w-0 ex-island h-full overflow-y-auto custom-scrollbar">
            <div className="w-full mx-auto p-4 sm:p-6 lg:p-8 min-h-full">
              <UpdateBanner />
              <ImpersonationBanner />
              {children}
            </div>
          </main>
        </div>
      )}
      <UploadStatus />
    </div>
  );
};
