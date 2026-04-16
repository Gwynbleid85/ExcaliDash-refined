import React from 'react';
import { UserPlus } from 'lucide-react';

type AccessControlCardProps = {
  registrationEnabled: boolean | null;
  localRegistrationAllowed: boolean;
  oidcEnabled: boolean;
  oidcProviderName: string | null;
  oidcJitProvisioningEnabled: boolean | null;
  loading: boolean;
  onToggleRegistration: () => void | Promise<void>;
  onToggleOidcJitProvisioning: () => void | Promise<void>;
};

const getRegistrationSummary = (
  registrationEnabled: boolean | null,
  localRegistrationAllowed: boolean
) => {
  if (registrationEnabled === null) return 'Loading…';
  if (!localRegistrationAllowed) return 'Local self-sign-up is managed by OIDC-only mode.';
  return registrationEnabled
    ? 'New users can create local accounts.'
    : 'Local self-sign-up is disabled.';
};

const getRegistrationLabel = (
  registrationEnabled: boolean | null,
  localRegistrationAllowed: boolean,
  loading: boolean
) => {
  if (registrationEnabled === null) return 'Loading…';
  if (!localRegistrationAllowed) return 'Managed by OIDC';
  if (loading) return 'Saving…';
  return registrationEnabled ? 'Enabled' : 'Disabled';
};

const getRegistrationButtonClassName = (
  registrationEnabled: boolean | null,
  localRegistrationAllowed: boolean
) =>
  `w-full h-10 px-3 rounded-ex border font-medium transition-colors text-sm ${
    !localRegistrationAllowed
      ? 'border-ex-border bg-ex-surface-muted text-ex-text-muted'
      : registrationEnabled
        ? 'border-ex-success bg-ex-success-soft text-ex-success'
        : 'border-ex-border bg-ex-surface text-ex-text hover:bg-ex-surface-hover'
  }`;

const getOidcLabel = (enabled: boolean | null, loading: boolean) => {
  if (enabled === null) return 'Loading…';
  if (loading) return 'Saving…';
  return enabled ? 'Enabled' : 'Invite-only';
};

export const AccessControlCard: React.FC<AccessControlCardProps> = ({
  registrationEnabled,
  localRegistrationAllowed,
  oidcEnabled,
  oidcProviderName,
  oidcJitProvisioningEnabled,
  loading,
  onToggleRegistration,
  onToggleOidcJitProvisioning,
}) => (
  <div className="mb-6 ex-island p-5 sm:p-6">
    <div className="flex items-center gap-3 mb-5">
      <div className="w-11 h-11 bg-ex-success-soft rounded-ex flex items-center justify-center">
        <UserPlus size={22} className="text-ex-success" />
      </div>
      <div className="min-w-0">
        <h2 className="ex-title text-2xl">Access control</h2>
        <p className="text-sm text-ex-text-muted">
          {getRegistrationSummary(registrationEnabled, localRegistrationAllowed)}
        </p>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div>
        <label className="block text-xs font-semibold text-ex-text-muted mb-1.5">
          Local self-sign-up
        </label>
        <button
          type="button"
          onClick={() => void onToggleRegistration()}
          disabled={loading || registrationEnabled === null || !localRegistrationAllowed}
          className={getRegistrationButtonClassName(
            registrationEnabled,
            localRegistrationAllowed
          )}
        >
          {getRegistrationLabel(registrationEnabled, localRegistrationAllowed, loading)}
        </button>
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
