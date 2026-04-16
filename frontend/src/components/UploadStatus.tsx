import React, { useState, useRef, useEffect } from 'react';
import { useUpload } from '../context/UploadContext';
import { Loader2, CheckCircle2, AlertCircle, X, ChevronUp, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

export const UploadStatus: React.FC = () => {
  const { tasks, clearCompleted, clearSuccessful, removeTask, isUploading } = useUpload();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const autoClearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isUploading) {
      setIsOpen(true);
    }
  }, [isUploading]);

  const hasActive = tasks.some(t => t.status === 'pending' || t.status === 'uploading' || t.status === 'processing');
  const hasSuccess = tasks.some(t => t.status === 'success');
  const hasErrors = tasks.some(t => t.status === 'error');

  useEffect(() => {
    if (autoClearTimerRef.current) {
      window.clearTimeout(autoClearTimerRef.current);
      autoClearTimerRef.current = null;
    }

    if (!hasActive && hasSuccess) {
      autoClearTimerRef.current = window.setTimeout(() => {
        clearSuccessful();
        if (!hasErrors) setIsOpen(false);
      }, hasErrors ? 5000 : 1200);
    }

    return () => {
      if (autoClearTimerRef.current) {
        window.clearTimeout(autoClearTimerRef.current);
        autoClearTimerRef.current = null;
      }
    };
  }, [hasActive, hasSuccess, hasErrors, clearSuccessful]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (tasks.length === 0) return null;

  const activeCount = tasks.filter(t => t.status === 'pending' || t.status === 'uploading' || t.status === 'processing').length;
  const completedCount = tasks.filter(t => t.status === 'success').length;
  const errorCount = tasks.filter(t => t.status === 'error').length;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 isolate" ref={popoverRef}>
      {isOpen && (
        <div className="w-80 ex-island overflow-hidden ex-animate-in mb-2">
          <div className="p-3 border-b border-ex-divider flex items-center justify-between bg-ex-surface-muted">
            <h3 className="font-semibold text-sm text-ex-text">
              Uploads ({activeCount > 0 ? `${activeCount} active` : 'Done'})
            </h3>
            {(completedCount > 0 || errorCount > 0) && !isUploading && (
              <button
                onClick={clearCompleted}
                className="text-xs text-ex-text-muted hover:text-ex-primary font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
            {tasks.map((task) => (
              <div key={task.id} className="group flex items-center gap-3 p-2 hover:bg-ex-surface-hover rounded-ex-sm transition-colors">
                <div className="flex-shrink-0">
                  {task.status === 'uploading' && <Loader2 size={18} className="text-ex-primary animate-spin" />}
                  {task.status === 'processing' && <Loader2 size={18} className="text-ex-primary animate-spin" />}
                  {task.status === 'success' && <CheckCircle2 size={18} className="text-ex-success" />}
                  {task.status === 'error' && <AlertCircle size={18} className="text-ex-danger" />}
                  {task.status === 'pending' && <div className="w-[18px] h-[18px] rounded-full border border-ex-border-strong" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ex-text truncate" title={task.fileName}>
                      {task.fileName}
                    </p>
                    <button
                      onClick={() => removeTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-ex-text-subtle hover:text-ex-text transition-opacity p-0.5"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-ex-surface-muted rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full transition-all duration-300 ease-out rounded-full',
                          task.status === 'error' ? 'bg-ex-danger' : task.status === 'success' ? 'bg-ex-success' : 'bg-ex-primary'
                        )}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    {task.status === 'error' ? (
                      <span className="text-[10px] text-ex-danger font-medium truncate max-w-[80px]" title={task.error}>Failed</span>
                    ) : (
                      <span className="text-[10px] text-ex-text-subtle font-medium w-8 text-right">{task.progress}%</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'h-12 w-12 rounded-full border border-ex-border bg-ex-surface text-ex-text shadow-ex-island hover:shadow-ex-raised hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center relative',
          isOpen && 'bg-ex-surface-hover'
        )}
      >
        {isUploading ? (
          <div className="relative">
            <Loader2 size={22} className="animate-spin text-ex-primary" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ex-primary opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ex-primary" />
            </span>
          </div>
        ) : (
          <div className="relative">
            {isOpen ? <ChevronDown size={22} /> : <ChevronUp size={22} />}
            {(completedCount > 0 || errorCount > 0) && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-ex-success rounded-full border-2 border-ex-surface" />
            )}
          </div>
        )}
      </button>
    </div>
  );
};
