
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PenTool, Trash2, FolderInput, ArrowRight, Check, Clock, Copy, Download, Loader2 } from 'lucide-react';
import type { DrawingSummary, Collection, Drawing } from '../types';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { exportDrawingToFile } from '../utils/exportUtils';
import { previewHasEmbeddedImages } from '../utils/previewSvg';

import * as api from '../api';

type HydratedDrawingData = {
  elements: any[];
  appState: any;
  files: Record<string, any>;
};

const normalizeImageElementsForPreview = (
  elements: any[] = [],
  files: Record<string, any> = {}
): any[] =>
  elements.map((element) => {
    if (!element || element.type !== "image" || typeof element.fileId !== "string") {
      return element;
    }

    const file = files[element.fileId];
    const hasImageData =
      typeof file?.dataURL === "string" &&
      file.dataURL.startsWith("data:image/") &&
      file.dataURL.length > 0;

    if (!hasImageData || element.status === "saved") {
      return element;
    }

    return {
      ...element,
      status: "saved",
    };
  });

interface DrawingCardProps {
  drawing: DrawingSummary;
  collections: Collection[];
  isSelected: boolean;
  isTrash?: boolean;
  isShared?: boolean;
  onToggleSelection: (e: React.MouseEvent) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onMoveToCollection: (id: string, collectionId: string | null) => void;
  onDuplicate: (id: string) => void;
  onClick: (id: string, e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onMouseDown?: (e: React.MouseEvent, id: string) => void;
  onPreviewGenerated?: (id: string, preview: string) => void;
}

const ContextMenuPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return createPortal(children, document.body);
};

export const DrawingCard: React.FC<DrawingCardProps> = ({
  drawing,
  collections,
  isSelected,
  isTrash = false,
  isShared = false,
  onToggleSelection,
  onRename,
  onDelete,
  onMoveToCollection,
  onDuplicate,
  onClick,
  onDragStart,
  onMouseDown,
  onPreviewGenerated,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  const [newName, setNewName] = useState(drawing.name);
  const [previewSvg, setPreviewSvg] = useState<string | null>(drawing.preview ?? null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [fullData, setFullData] = useState<HydratedDrawingData | null>(null);
  const hasEmbeddedImages = previewHasEmbeddedImages(previewSvg);

  const fullDataRef = React.useRef(fullData);
  fullDataRef.current = fullData;
  const fullDataPromiseRef = React.useRef<Promise<HydratedDrawingData> | null>(null);

  useEffect(() => {
    setFullData(null);
    fullDataPromiseRef.current = null;
  }, [drawing.id]);

  const drawingIdRef = React.useRef(drawing.id);
  drawingIdRef.current = drawing.id;

  const ensureFullData = useCallback(async (): Promise<HydratedDrawingData> => {
    if (fullDataRef.current) {
      return fullDataRef.current;
    }
    if (fullDataPromiseRef.current) {
      return fullDataPromiseRef.current;
    }
    const currentDrawingId = drawingIdRef.current;
    const promise = api.getDrawing(currentDrawingId).then((fullDrawing) => {
      const payload: HydratedDrawingData = {
        elements: fullDrawing.elements || [],
        appState: fullDrawing.appState || {},
        files: fullDrawing.files || {},
      };
      setFullData(payload);
      fullDataPromiseRef.current = null;
      return payload;
    }).catch((error) => {
      fullDataPromiseRef.current = null;
      throw error;
    });
    fullDataPromiseRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (drawing.preview) {
      setPreviewSvg(drawing.preview);
      return;
    }

    const generatePreview = async () => {
      try {
        const data = await ensureFullData();
        if (cancelled) return;
        if (!data?.elements || !data?.appState) return;

        const { exportToSvg } = await import("@excalidraw/excalidraw");

        if (cancelled) return;

        const svg = await exportToSvg({
          elements: normalizeImageElementsForPreview(data.elements, data.files || {}),
          appState: {
            ...data.appState,
            exportBackground: true,
            viewBackgroundColor: data.appState.viewBackgroundColor || "#ffffff"
          },
          files: data.files || {},
          exportPadding: 10
        });
        if (cancelled) return;
        const previewHtml = svg.outerHTML;
        setPreviewSvg(previewHtml);

        onPreviewGenerated?.(drawing.id, previewHtml);
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to generate preview", e);
        }
      }
    };

    generatePreview();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing.id, drawing.preview, onPreviewGenerated]);

  const handleExport = useCallback(async () => {
    try {
      setIsExporting(true);
      setExportError(null);
      const data = await ensureFullData();
      const drawingPayload: Drawing = {
        ...drawing,
        elements: data.elements || [],
        appState: data.appState || {},
        files: data.files || {},
      };
      exportDrawingToFile(drawingPayload);
    } catch (error) {
      console.error("Failed to export drawing", error);
      setExportError("Failed to export drawing. Please try again.");
      setTimeout(() => setExportError(null), 3000);
    } finally {
      setIsExporting(false);
    }
  }, [drawing, ensureFullData]);


  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      onRename(drawing.id, newName);
      setIsRenaming(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
    setShowMoveSubmenu(false);
  };

  return (
    <>
      <div
        id={`drawing-card-${drawing.id}`}
        onContextMenu={handleContextMenu}
        draggable={!isRenaming && drawing.accessLevel === 'owner'}
        onDragStart={(e) => {
          if (isRenaming) {
            e.preventDefault();
            return;
          }
          if (drawing.accessLevel !== 'owner') {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData('drawingId', drawing.id);
          onDragStart?.(e, drawing.id);
        }}
        onMouseDown={(e) => onMouseDown?.(e, drawing.id)}
        className={clsx(
          'drawing-card group relative flex flex-col ex-card',
          !isTrash && 'ex-card-interactive',
          isTrash && 'opacity-80 grayscale-[0.3]',
          isSelected && 'ex-card-selected'
        )}
      >
        <div
          className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ opacity: isSelected ? 1 : undefined }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelection(e); }}
            data-testid={`select-drawing-${drawing.id}`}
            aria-pressed={isSelected}
            aria-label={`${isSelected ? 'Deselect' : 'Select'} ${drawing.name}`}
            className={clsx(
              'w-6 h-6 rounded-full border flex items-center justify-center transition-all duration-150 shadow-ex-soft',
              isSelected
                ? 'bg-ex-primary border-ex-primary text-ex-primary-contrast'
                : 'bg-ex-surface border-ex-border hover:border-ex-primary'
            )}
          >
            {isSelected && <Check size={14} strokeWidth={3} />}
          </button>
        </div>

        <div
          onClick={(e) => !isTrash && onClick(drawing.id, e)}
          className={clsx(
            'aspect-[16/10] bg-ex-surface-muted relative overflow-hidden flex items-center justify-center border-b border-ex-border rounded-t-[11px] transition-colors',
            !isTrash && 'cursor-pointer group-hover:bg-ex-surface-hover',
            isTrash && 'cursor-default'
          )}
        >
          {previewSvg ? (
            <div
              className={clsx(
                'w-full h-full p-3 sm:p-4 lg:p-5 flex items-center justify-center [&>svg]:w-auto [&>svg]:h-auto [&>svg]:max-w-full [&>svg]:max-h-full transition-transform duration-500',
                !hasEmbeddedImages && "dark:[&>svg]:invert dark:[&>svg_rect[fill='white']]:opacity-0 dark:[&>svg_rect[fill='#ffffff']]:opacity-0"
              )}
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-ex-surface rounded-ex-lg border border-ex-border flex items-center justify-center text-ex-text-subtle shadow-ex-soft transform group-hover:scale-105 transition-transform duration-500">
              <PenTool size={28} strokeWidth={1.5} />
            </div>
          )}
        </div>

        <div className="p-3 sm:p-4 relative z-10">
          {isRenaming ? (
            <form
              onSubmit={handleRenameSubmit}
              onClick={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
            >
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => setIsRenaming(false)}
                onDragStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="ex-input text-sm font-semibold"
              />
            </form>
          ) : (
            <h3
              className="text-sm sm:text-base font-semibold text-ex-text truncate cursor-text select-none"
              title={drawing.name}
              onDoubleClick={(e) => {
                e.stopPropagation();
                const canRename =
                  !isTrash &&
                  (drawing.accessLevel === 'edit' ||
                    drawing.accessLevel === 'owner');
                if (canRename) setIsRenaming(true);
              }}
            >
              {drawing.name}
            </h3>
          )}
          <div className="flex items-center justify-between mt-2.5 relative">
            <p className="text-[11px] font-medium text-ex-text-subtle flex items-center gap-1.5">
              <Clock size={11} />
              {formatDistanceToNow(drawing.updatedAt)} ago
            </p>

            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => {
                  if (drawing.accessLevel !== 'owner') return;
                  setShowCollectionDropdown(!showCollectionDropdown);
                }}
                data-testid={`collection-picker-${drawing.id}`}
                aria-haspopup="listbox"
                aria-expanded={showCollectionDropdown}
                disabled={drawing.accessLevel !== 'owner'}
                className={clsx(
                  'ex-chip max-w-[120px] truncate',
                  drawing.accessLevel !== 'owner' && 'cursor-not-allowed opacity-70'
                )}
              >
                <span className="truncate">
                  {drawing.accessLevel !== 'owner' || isShared
                    ? 'Shared'
                    : drawing.collectionId
                      ? (collections.find(c => c.id === drawing.collectionId)?.name || 'Collection')
                      : 'Unorganized'}
                </span>
              </button>

              {drawing.accessLevel === 'owner' && showCollectionDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowCollectionDropdown(false)} />
                  <div className="absolute right-0 bottom-8 w-52 z-20 ex-menu max-h-56 overflow-y-auto custom-scrollbar ex-animate-in">
                    <button
                      data-testid="collection-option-unorganized"
                      onClick={() => { onMoveToCollection(drawing.id, null); setShowCollectionDropdown(false); }}
                      data-active={drawing.collectionId === null}
                      className="ex-menu-item"
                    >
                      <span className="flex-1 truncate">Unorganized</span>
                      {drawing.collectionId === null && <Check size={12} />}
                    </button>
                    {collections.map(c => (
                      <button
                        key={c.id}
                        data-testid={`collection-option-${c.id}`}
                        onClick={() => { onMoveToCollection(drawing.id, c.id); setShowCollectionDropdown(false); }}
                        data-active={drawing.collectionId === c.id}
                        className="ex-menu-item"
                      >
                        <span className="flex-1 truncate">{c.name}</span>
                        {drawing.collectionId === c.id && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {contextMenu && (
        <ContextMenuPortal>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          >
            <div
              className="absolute ex-menu min-w-[180px] ex-animate-in"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              {(!isTrash &&
                (drawing.accessLevel === 'edit' ||
                  drawing.accessLevel === 'owner')) ? (
                <button
                  onClick={() => {
                    setIsRenaming(true);
                    setContextMenu(null);
                  }}
                  className="ex-menu-item"
                >
                  <PenTool size={14} /> Rename
                </button>
              ) : null}

              {drawing.accessLevel === 'owner' ? (
                <div
                  className="relative"
                  onMouseEnter={() => setShowMoveSubmenu(true)}
                  onMouseLeave={() => setShowMoveSubmenu(false)}
                >
                  <button className="ex-menu-item w-full justify-between">
                    <span className="flex items-center gap-2"><FolderInput size={14} /> Move to…</span>
                    <ArrowRight size={12} />
                  </button>

                  {showMoveSubmenu && (
                    <div className="absolute left-full top-0 ml-1 w-44 ex-menu max-h-64 overflow-y-auto custom-scrollbar">
                      <button
                        onClick={() => { onMoveToCollection(drawing.id, null); setContextMenu(null); }}
                        data-active={drawing.collectionId === null}
                        className="ex-menu-item"
                      >
                        <span className="flex-1">Unorganized</span>
                        {drawing.collectionId === null && <Check size={10} />}
                      </button>
                      {collections.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { onMoveToCollection(drawing.id, c.id); setContextMenu(null); }}
                          data-active={drawing.collectionId === c.id}
                          className="ex-menu-item"
                        >
                          <span className="flex-1 truncate">{c.name}</span>
                          {drawing.collectionId === c.id && <Check size={10} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {drawing.accessLevel === 'owner' ? (
                <>
                  <div className="ex-menu-divider" />
                  <button
                    onClick={() => {
                      onDuplicate(drawing.id);
                      setContextMenu(null);
                    }}
                    className="ex-menu-item"
                  >
                    <Copy size={14} /> Duplicate
                  </button>
                </>
              ) : null}

              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  await handleExport();
                  setContextMenu(null);
                }}
                disabled={isExporting}
                className="ex-menu-item"
              >
                {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {isExporting ? 'Exporting…' : 'Export'}
              </button>
              {exportError && (
                <div className="px-2.5 py-1.5 text-xs text-ex-danger bg-ex-danger-soft rounded-ex-sm mx-1">
                  {exportError}
                </div>
              )}

              {drawing.accessLevel === 'owner' ? (
                <>
                  <div className="ex-menu-divider" />
                  <button
                    onClick={() => {
                      onDelete(drawing.id);
                      setContextMenu(null);
                    }}
                    className="ex-menu-item"
                    data-variant="danger"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </ContextMenuPortal>
      )}
    </>
  );
};
