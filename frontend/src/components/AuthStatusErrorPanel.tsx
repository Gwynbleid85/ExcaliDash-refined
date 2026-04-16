import React from 'react';

type AuthStatusErrorPanelProps = {
  message: string;
  onRetry: () => void | Promise<void>;
  fullScreen?: boolean;
};

export const AuthStatusErrorPanel: React.FC<AuthStatusErrorPanelProps> = ({
  message,
  onRetry,
  fullScreen = false,
}) => {
  const panel = (
    <div className="max-w-lg rounded-ex border border-ex-danger bg-ex-danger-soft p-4 text-sm text-ex-text">
      <div>{message}</div>
      <button
        type="button"
        onClick={() => void onRetry()}
        className="ex-btn ex-btn-ghost mt-3"
      >
        Retry connection
      </button>
    </div>
  );

  if (!fullScreen) {
    return panel;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ex-bg px-4">
      {panel}
    </div>
  );
};
