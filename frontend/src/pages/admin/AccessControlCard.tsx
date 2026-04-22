import React from 'react';
import { Copy, Link2, UserPlus } from 'lucide-react';
import type { RegistrationMode } from '../../api';

type SignupLinkSummary = {
  id: string;
  createdByUserId: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AccessControlCardProps = {
  registrationEnabled: boolean | null;
  registrationMode: RegistrationMode | null;
  localRegistrationAllowed: boolean;
  oidcEnabled: boolean;
  oidcProviderName: string | null;
  oidcJitProvisioningEnabled: boolean | null;
  signupLinks: SignupLinkSummary[];
  signupLinkExpiryEnabled: boolean;
  signupLinkExpiresAt: string;
  createdSignupUrl: string | null;
  revokeSignupLinkId: string | null;
  loading: boolean;
  onRegistrationModeChange: (mode: RegistrationMode) => void | Promise<void>;
  onToggleOidcJitProvisioning: () => void | Promise<void>;
  onSignupLinkExpiryEnabledChange: (enabled: boolean) => void;
  onSignupLinkExpiresAtChange: (value: string) => void;
  onCreateSignupLink: () => void | Promise<void>;
  onRevokeSignupLink: (id: string) => void | Promise<void>;
};

const formatDate = (value: string | null): string => {
  if (!value) return 'No expiry';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Invalid date';
  return parsed.toLocaleString();
};

const getRegistrationSummary = (
  registrationMode: RegistrationMode | null,
  localRegistrationAllowed: boolean
) => {
  if (registrationMode === null) return 'Loading…';
  if (!localRegistrationAllowed) return 'Local self-sign-up is managed by OIDC-only mode.';
  if (registrationMode === 'public') return 'Anyone can create a local account.';
  if (registrationMode === 'link_only') return 'Only users with a signup link can create a local account.';
  return 'Local self-sign-up is disabled.';
};

const getOidcLabel = (enabled: boolean | null, loading: boolean) => {
  if (enabled === null) return 'Loading…';
  if (loading) return 'Saving…';
  return enabled ? 'Enabled' : 'Invite-only';
};

export const AccessControlCard: React.FC<AccessControlCardProps> = ({
  registrationEnabled,
  registrationMode,
  localRegistrationAllowed,
  oidcEnabled,
  oidcProviderName,
  oidcJitProvisioningEnabled,
  signupLinks,
  signupLinkExpiryEnabled,
  signupLinkExpiresAt,
  createdSignupUrl,
  revokeSignupLinkId,
  loading,
  onRegistrationModeChange,
  onToggleOidcJitProvisioning,
  onSignupLinkExpiryEnabledChange,
  onSignupLinkExpiresAtChange,
  onCreateSignupLink,
  onRevokeSignupLink,
}) => (
  <div className="mb-6 ex-island p-5 sm:p-6">
    <div className="flex items-center gap-3 mb-5">
      <div className="w-11 h-11 bg-ex-success-soft rounded-ex flex items-center justify-center">
        <UserPlus size={22} className="text-ex-success" />
      </div>
      <div className="min-w-0">
        <h2 className="ex-title text-2xl">Access control</h2>
        <p className="text-sm text-ex-text-muted">
          {getRegistrationSummary(registrationMode, localRegistrationAllowed)}
        </p>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-semibold text-ex-text-muted mb-2">
          Local self-sign-up mode
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(['disabled', 'public', 'link_only'] as RegistrationMode[]).map((mode) => {
            const selected = registrationMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => void onRegistrationModeChange(mode)}
                disabled={loading || registrationMode === null || !localRegistrationAllowed}
                className={`h-10 px-3 rounded-ex border text-sm font-medium transition-colors ${
                  !localRegistrationAllowed
                    ? 'border-ex-border bg-ex-surface-muted text-ex-text-muted'
                    : selected
                      ? 'border-ex-success bg-ex-success-soft text-ex-success'
                      : 'border-ex-border bg-ex-surface text-ex-text hover:bg-ex-surface-hover'
                }`}
              >
                {mode === 'disabled' ? 'Disabled' : mode === 'public' ? 'Public' : 'Link-only'}
              </button>
            );
          })}
        </div>
        {registrationMode !== null && localRegistrationAllowed && (
          <div className="mt-3 text-xs text-ex-text-muted">
            Current public signup status: {registrationEnabled ? 'open to everyone' : 'not public'}.
          </div>
        )}
      </div>

      {oidcEnabled && (
        <div>
          <label className="block text-xs font-semibold text-ex-text-muted mb-1.5">
            {oidcProviderName || 'OIDC'} auto-provisioning
          </label>
          <button
            type="button"
            onClick={() => void onToggleOidcJitProvisioning()}
            disabled={loading || oidcJitProvisioningEnabled === null}
            className={`w-full h-10 px-3 rounded-ex border font-medium transition-colors text-sm ${
              oidcJitProvisioningEnabled
                ? 'border-ex-primary bg-ex-primary-soft text-ex-primary'
                : 'border-ex-border bg-ex-surface text-ex-text hover:bg-ex-surface-hover'
            }`}
          >
            {getOidcLabel(oidcJitProvisioningEnabled, loading)}
          </button>
        </div>
      )}
    </div>

    {registrationMode === 'link_only' && localRegistrationAllowed && (
      <div className="mt-5 rounded-ex border border-ex-border bg-ex-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <Link2 size={16} className="text-ex-primary" />
          <div className="font-semibold text-sm text-ex-text">Signup links</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[auto,1fr,auto] gap-3 items-end">
          <label className="flex items-center gap-2 text-sm text-ex-text">
            <input
              type="checkbox"
              checked={signupLinkExpiryEnabled}
              onChange={(event) => onSignupLinkExpiryEnabledChange(event.target.checked)}
            />
            Set expiry
          </label>
          <input
            type="datetime-local"
            value={signupLinkExpiresAt}
            onChange={(event) => onSignupLinkExpiresAtChange(event.target.value)}
            disabled={!signupLinkExpiryEnabled || loading}
            className="ex-input"
          />
          <button
            type="button"
            onClick={() => void onCreateSignupLink()}
            disabled={loading}
            className="ex-btn ex-btn-primary h-11"
          >
            Create link
          </button>
        </div>

        {createdSignupUrl && (
          <div className="mt-4 rounded-ex border border-ex-primary bg-ex-primary-soft p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-ex-primary mb-2">
              New signup link
            </div>
            <div className="flex gap-2 items-start">
              <code className="flex-1 text-xs break-all text-ex-text">{createdSignupUrl}</code>
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(createdSignupUrl)}
                className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-ex-sm border border-ex-border bg-ex-surface text-ex-text hover:bg-ex-surface-hover"
                aria-label="Copy signup link"
                title="Copy signup link"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {signupLinks.length === 0 ? (
            <div className="text-sm text-ex-text-muted">No signup links created yet.</div>
          ) : (
            signupLinks.map((link) => (
              <div key={link.id} className="rounded-ex border border-ex-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ex-text">
                      Created {formatDate(link.createdAt)}
                    </div>
                    <div className="text-xs text-ex-text-muted">
                      Expires: {formatDate(link.expiresAt)}
                    </div>
                    <div className="text-xs text-ex-text-muted">
                      Status: {link.revokedAt ? `Revoked ${formatDate(link.revokedAt)}` : 'Active'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onRevokeSignupLink(link.id)}
                    disabled={Boolean(link.revokedAt) || revokeSignupLinkId === link.id}
                    className="ex-btn ex-btn-ghost"
                  >
                    {revokeSignupLinkId === link.id ? 'Revoking…' : link.revokedAt ? 'Revoked' : 'Revoke'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )}

    {oidcEnabled && oidcJitProvisioningEnabled !== null && (
      <div className="mt-4 rounded-ex border border-ex-primary bg-ex-primary-soft p-3 text-sm text-ex-text">
        <div className="font-semibold">
          {oidcProviderName || 'OIDC'} access:{' '}
          {oidcJitProvisioningEnabled ? 'Auto-provisioning enabled' : 'Invite-only'}
        </div>
        <div className="mt-1 text-ex-text-muted">
          {oidcJitProvisioningEnabled
            ? 'Any successfully authenticated OIDC user can get an account on first sign-in.'
            : 'Only users pre-created below can sign in through OIDC. Use OIDC-only invites for accounts that should not have a local password.'}
        </div>
      </div>
    )}
  </div>
);
