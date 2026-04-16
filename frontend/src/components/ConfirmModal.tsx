import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import clsx from 'clsx';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
  showCancel?: boolean;
  variant?: 'warning' | 'success';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDangerous = true,
  showCancel = true,
  variant = 'warning',
}) => {
  if (!isOpen) return null;

  const isSuccess = variant === 'success';
  const IconComponent = isSuccess ? CheckCircle : AlertTriangle;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onCancel}
      />

      <div className="relative w-full max-w-md ex-island p-6 ex-animate-in">
        <button
          onClick={onCancel}
          className="absolute right-3 top-3 p-1.5 rounded-ex-sm text-ex-text-subtle hover:text-ex-text hover:bg-ex-surface-hover transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          <div
            className={clsx(
              'w-12 h-12 rounded-full flex items-center justify-center',
              isSuccess
                ? 'bg-ex-success-soft text-ex-success'
                : isDangerous
                  ? 'bg-ex-danger-soft text-ex-danger'
                  : 'bg-ex-primary-soft text-ex-primary'
            )}
          >
            <IconComponent size={24} strokeWidth={2.5} />
          </div>

          <div className="space-y-2">
            <h3 className="ex-title text-xl text-ex-text">{title}</h3>
            <div className="text-sm text-ex-text-muted leading-relaxed">
              {message}
            </div>
          </div>

          <div className="flex gap-2 w-full mt-2">
            {showCancel && (
              <button
                onClick={onCancel}
                className="ex-btn ex-btn-ghost flex-1"
              >
                {cancelText}
              </button>
            )}

            <button
              onClick={onConfirm}
              className={clsx(
                'ex-btn flex-1',
                isDangerous ? 'ex-btn-danger' : 'ex-btn-primary'
              )}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
