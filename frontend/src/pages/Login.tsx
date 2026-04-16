import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import * as api from '../api';
import { USER_KEY } from '../utils/impersonation';
import { getPasswordPolicy, validatePassword } from '../utils/passwordPolicy';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { AuthStatusErrorPanel } from '../components/AuthStatusErrorPanel';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const {
    login,
    logout,
    authEnabled,
    registrationEnabled,
    authStatusError,
    retryAuthStatus,
    oidcEnabled,
    oidcEnforced,
    oidcProvider,
    bootstrapRequired,
    authOnboardingRequired,
    isAuthenticated,
    loading: authLoading,
    user,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryMustReset = searchParams.get('mustReset') === '1';
  const oidcErrorCode = searchParams.get('oidcError');
  const oidcErrorMessage = searchParams.get('oidcErrorMessage');
  const oidcReturnTo = searchParams.get('returnTo') || '/';
  const mustReset = Boolean(user?.mustResetPassword) || queryMustReset;
  const passwordPolicy = getPasswordPolicy();

  useEffect(() => {
    if (!oidcErrorCode) return;
    setError(oidcErrorMessage || 'OIDC sign-in failed');
  }, [oidcErrorCode, oidcErrorMessage]);

  useEffect(() => {
    if (authStatusError) return;
    if (authLoading || authEnabled === null) return;
    if (authOnboardingRequired) {
      navigate('/auth-setup', { replace: true });
      return;
    }
    if (!authEnabled) {
      navigate('/', { replace: true });
      return;
    }
    if (bootstrapRequired) {
      navigate('/register', { replace: true });
      return;
    }
    if (oidcEnforced && !mustReset) {
      if (!oidcErrorCode) {
        api.startOidcSignIn(oidcReturnTo);
      }
      return;
    }
    if (isAuthenticated) {
      if (mustReset) return;
      navigate('/', { replace: true });
    }
  }, [
    authEnabled,
    authLoading,
    authOnboardingRequired,
    authStatusError,
    bootstrapRequired,
    isAuthenticated,
    mustReset,
    navigate,
    oidcEnforced,
    oidcErrorCode,
    oidcReturnTo,
  ]);

  if (authStatusError) {
    return <AuthStatusErrorPanel message={authStatusError} onRetry={retryAuthStatus} fullScreen />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      const stored = localStorage.getItem(USER_KEY);
      const storedUser = stored ? (JSON.parse(stored) as { mustResetPassword?: boolean } | null) : null;
      if (storedUser?.mustResetPassword) {
        setPassword('');
        return;
      }
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to login';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleMustReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || !confirmNewPassword) {
      setError('Please enter and confirm a new password');
      return;
    }
    const passwordError = validatePassword(newPassword, passwordPolicy);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await api.api.post<{
        user: { id: string; email: string; name: string; role?: string; mustResetPassword?: boolean };
      }>('/auth/must-reset-password', { newPassword });

      localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));

      window.location.href = '/';
    } catch (err: unknown) {
      let message = 'Failed to reset password';
      if (api.isAxiosError(err)) {
        message = err.response?.data?.message || err.response?.data?.error || message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ex-bg px-4 py-10">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Logo className="mx-auto h-12 w-auto" />
          <h2 className="ex-title mt-5 text-3xl">
            {mustReset
              ? 'Reset your password'
              : oidcEnforced
                ? `Sign in with ${oidcProvider || 'OIDC'}`
                : 'Welcome back'}
          </h2>
          {!mustReset && !oidcEnforced && registrationEnabled ? (
            <p className="mt-2 text-sm text-ex-text-muted">
              Or{' '}
              <Link to="/register" className="font-semibold text-ex-primary hover:text-ex-primary-hover">
                create a new account
              </Link>
            </p>
          ) : !mustReset && !oidcEnforced ? (
            <p className="mt-2 text-sm text-ex-text-muted">Sign in with an existing account.</p>
          ) : mustReset ? (
            <p className="mt-2 text-sm text-ex-text-muted">
              Your admin requires you to set a new password before using ExcaliDash.
            </p>
          ) : (
            <p className="mt-2 text-sm text-ex-text-muted">
              You will be redirected to {oidcProvider || 'your identity provider'}.
            </p>
          )}
        </div>

        <div className="ex-island p-6 sm:p-8">
          <form className="space-y-5" onSubmit={mustReset ? handleMustReset : handleSubmit}>
            {error && (
              <div className="rounded-ex border border-ex-danger bg-ex-danger-soft p-3 text-sm text-ex-danger font-medium">
                {error}
              </div>
            )}

            {oidcEnforced && !mustReset ? (
              <button
                type="button"
                onClick={() => api.startOidcSignIn(oidcReturnTo)}
                className="ex-btn ex-btn-primary w-full h-11"
              >
                Continue with {oidcProvider || 'OIDC'}
              </button>
            ) : (
              <>
                <div className="space-y-4">
                  {!mustReset ? (
                    <>
                      <div>
                        <label htmlFor="email" className="block text-xs font-semibold text-ex-text-muted mb-1.5">Email address</label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          className="ex-input"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="password" className="block text-xs font-semibold text-ex-text-muted mb-1.5">Password</label>
                        <input
                          id="password"
                          name="password"
                          type="password"
                          autoComplete="current-password"
                          required
                          className="ex-input"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="newPassword" className="block text-xs font-semibold text-ex-text-muted mb-1.5">New password</label>
                        <input
                          id="newPassword"
                          name="newPassword"
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength={passwordPolicy.minLength}
                          maxLength={passwordPolicy.maxLength}
                          pattern={passwordPolicy.patternHtml}
                          className="ex-input"
                          placeholder="New password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="confirmNewPassword" className="block text-xs font-semibold text-ex-text-muted mb-1.5">Confirm new password</label>
                        <input
                          id="confirmNewPassword"
                          name="confirmNewPassword"
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength={passwordPolicy.minLength}
                          maxLength={passwordPolicy.maxLength}
                          className="ex-input"
                          placeholder="Confirm new password"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>

                {mustReset && (
                  <PasswordRequirements password={newPassword} policy={passwordPolicy} />
                )}
              </>
            )}

            {!mustReset && !oidcEnforced && (
              <div className="flex justify-end">
                <Link to="/reset-password" className="text-sm font-semibold text-ex-primary hover:text-ex-primary-hover">
                  Forgot your password?
                </Link>
              </div>
            )}

            {(!oidcEnforced || mustReset) && (
              <button type="submit" disabled={loading} className="ex-btn ex-btn-primary w-full h-11">
                {mustReset
                  ? (loading ? 'Updating…' : 'Set new password')
                  : (loading ? 'Signing in…' : 'Sign in')}
              </button>
            )}

            {!mustReset && oidcEnabled && !oidcEnforced && (
              <>
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-ex-divider" />
                  <span className="text-xs text-ex-text-subtle uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-ex-divider" />
                </div>
                <button
                  type="button"
                  onClick={() => api.startOidcSignIn('/')}
                  className="ex-btn ex-btn-ghost w-full h-11"
                >
                  Continue with {oidcProvider || 'OIDC'}
                </button>
              </>
            )}

            {mustReset && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setNewPassword('');
                    setConfirmNewPassword('');
                    logout();
                  }}
                  className="text-sm font-semibold text-ex-primary hover:text-ex-primary-hover"
                >
                  Sign in as a different user
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
