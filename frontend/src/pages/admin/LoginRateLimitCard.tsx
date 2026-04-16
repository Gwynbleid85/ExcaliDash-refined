import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';

type LoginRateLimitCardProps = {
  loading: boolean;
  saving: boolean;
  autoSaveQueued: boolean;
  dirty: boolean;
  enabled: boolean;
  windowMinutes: number;
  maxAttempts: number;
  resetIdentifier: string;
  resetLoading: boolean;
  userEmails: string[];
  onToggleEnabled: () => void;
  onWindowMinutesChange: (value: number) => void;
  onMaxAttemptsChange: (value: number) => void;
  onResetIdentifierChange: (value: string) => void;
  onReset: () => void | Promise<void>;
};

const getSaveStatusLabel = (saving: boolean, autoSaveQueued: boolean, dirty: boolean) => {
  if (saving || autoSaveQueued) return 'Saving changes…';
  return dirty ? 'Unsaved changes' : 'All changes saved';
};

export const LoginRateLimitCard: React.FC<LoginRateLimitCardProps> = ({
  loading,
  saving,
  autoSaveQueued,
  dirty,
  enabled,
  windowMinutes,
  maxAttempts,
  resetIdentifier,
  resetLoading,
  userEmails,
  onToggleEnabled,
  onWindowMinutesChange,
  onMaxAttemptsChange,
  onResetIdentifierChange,
  onReset,
}) => (
  <div className="mb-6 ex-island p-5 sm:p-6">
    <div className="flex items-center gap-3 mb-5">
      <div className="w-11 h-11 bg-ex-surface-muted rounded-ex flex items-center justify-center border border-ex-border">
        <SettingsIcon size={22} className="text-ex-text-muted" />
      </div>
      <div className="min-w-0">
        <h2 className="ex-title text-2xl">Login rate limiting</h2>
        <p className="text-sm text-ex-text-muted">
          Reduce brute-force attacks; disable only for trusted environments. Changes are saved automatically.
        </p>
      </div>
      {loading && (
        <span className="ml-auto text-sm text-ex-text-subtle">Loading…</span>
      )}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div>
        <label className="block text-xs font-semibold text-ex-text-muted mb-1.5">Rate limiting</label>
        <button
          type="button"
          onClick={onToggleEnabled}
          className={`w-full h-10 px-3 rounded-ex border font-medium transition-colors text-sm ${
            enabled
              ? 'border-ex-success bg-ex-success-soft text-ex-success'
              : 'border-ex-border bg-ex-surface text-ex-text hover:bg-ex-surface-hover'
          }`}
        >
          {enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>
      <div>
        <label className="block text-xs font-semibold text-ex-text-muted mb-1.5">Window (minutes)</label>
        <input
          type="number"
          min={1}
          value={windowMinutes}
          onChange={(event) => onWindowMinutesChange(Number(event.target.value))}
          className="ex-input"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-ex-text-muted mb-1.5">Max attempts</label>
        <input
          type="number"
          min={1}
          value={maxAttempts}
          onChange={(event) => onMaxAttemptsChange(Number(event.target.value))}
          className="ex-input"
        />
      </div>
    </div>

    <div className="mt-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        <label className="block text-xs font-semibold text-ex-text-muted mb-1.5">Reset lockout (email/username)</label>
        <input
          list="admin-user-identifiers"
          value={resetIdentifier}
          onChange={(event) => onResetIdentifierChange(event.target.value)}
          placeholder="user@example.com"
          className="ex-input"
        />
        <datalist id="admin-user-identifiers">
          {userEmails.map((email) => (
            <option key={email} value={email} />
          ))}
        </datalist>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <p className="text-xs text-ex-text-muted">
          {getSaveStatusLabel(saving, autoSaveQueued, dirty)}
        </p>
        <button
          onClick={() => void onReset()}
          disabled={resetLoading}
          className="ex-btn ex-btn-ghost"
        >
          {resetLoading ? 'Resetting…' : 'Reset'}
        </button>
      </div>
    </div>
  </div>
);
