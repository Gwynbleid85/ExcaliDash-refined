import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, Copy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import * as api from '../api';
import { getPasswordPolicy, validatePassword } from '../utils/passwordPolicy';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { AuthStatusErrorPanel } from '../components/AuthStatusErrorPanel';

export const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedBootstrapCmd, setCopiedBootstrapCmd] = useState(false);
  const {
    register,
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
  } = useAuth();
  const navigate = useNavigate();

  const passwordPolicy = getPasswordPolicy();

  const bootstrapLogsCommand =
    'docker compose -f docker-compose.prod.yml logs backend --tail=200 | grep "BOOTSTRAP SETUP"';

  const copyBootstrapCommand = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(bootstrapLogsCommand);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = bootstrapLogsCommand;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedBootstrapCmd(true);
      window.setTimeout(() => setCopiedBootstrapCmd(false), 1500);
    } catch {
    }
  };

  useEffect(() => {
    if (authStatusError) return;
    if (authLoading || authEnabled === null) return;
    if (authOnboardingRequired) {
      navigate('/auth-setup', { replace: true });
      return;
    }
    if (oidcEnforced) {
      api.startOidcSignIn('/');
      return;
    }
    if (!authEnabled) {
      navigate('/', { replace: true });
      return;
    }
    if (!bootstrapRequired && !registrationEnabled) {
      navigate('/login', { replace: true });
      return;
    }
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [
    authEnabled,
    authLoading,
    authOnboardingRequired,
    authStatusError,
    bootstrapRequired,
    isAuthenticated,
    navigate,
    oidcEnforced,
    registrationEnabled,
  ]);

  if (authStatusError) {
    return <AuthStatusErrorPanel message={authStatusError} onRetry={retryAuthStatus} fullScreen />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const passwordError = validatePassword(password, passwordPolicy);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (bootstrapRequired && setupCode.trim().length === 0) {
      setError('Bootstrap setup code is required');
      return;
    }

    setLoading(true);

    try {
      await register(email, password, name, bootstrapRequired ? setupCode : undefined);
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to register';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOidcBootstrap = () => {
    setError('');
    api.startOidcSignIn('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ex-bg px-4 py-10">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Logo className="mx-auto h-12 w-auto" />
          <h2 className="ex-title mt-5 text-3xl">
            {bootstrapRequired ? 'Set up admin account' : 'Create your account'}
          </h2>
          <p className="mt-2 text-sm text-ex-text-muted">
            {bootstrapRequired ? (
              <span>
                Set up your first admin account to finish enabling multi-user access for this
                ExcaliDash instance.
              </span>
            ) : (
              <>
                Or{' '}
                <Link to="/login" className="font-semibold text-ex-primary hover:text-ex-primary-hover">
                  sign in to your existing account
                </Link>
              </>
            )}
          </p>
          {bootstrapRequired && (
            <div className="mt-4 rounded-ex border border-ex-warning bg-ex-warning-soft p-3 text-xs text-ex-text text-left">
              <div className="font-semibold text-ex-warning uppercase tracking-wider">One-time setup code</div>
              <div className="mt-1 text-ex-text-muted">
                Find it in the backend logs (look for <code>[BOOTSTRAP SETUP]</code>):
              </div>
              <div className="mt-2 rounded-ex-sm bg-ex-surface border border-ex-border p-2">
                <div className="flex items-start gap-2">
                  <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[11px] leading-snug text-ex-text font-mono">
                    <code className="select-all">{bootstrapLogsCommand}</code>
                  </pre>
                  <button
                    type="button"
                    onClick={() => void copyBootstrapCommand()}
                    className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-ex-sm border border-ex-border bg-ex-surface text-ex-text hover:bg-ex-surface-hover transition-colors"
                    aria-label={copiedBootstrapCmd ? 'Copied docker command' : 'Copy docker command'}
                    title={copiedBootstrapCmd ? 'Copied' : 'Copy'}
                  >
                    {copiedBootstrapCmd ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              <div className="mt-2 text-ex-text-muted">
                If you are not using <code>docker-compose.prod.yml</code>, drop the <code>-f ...</code> flag.
              </div>
            </div>
          )}
        </div>

        <div className="ex-island p-6 sm:p-8">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-ex border border-ex-danger bg-ex-danger-soft p-3 text-sm text-ex-danger font-medium">
                {error}
              </div>
            )}

            {bootstrapRequired && oidcEnabled && !oidcEnforced && (
              <>
                <button
                  type="button"
                  onClick={handleOidcBootstrap}
                  disabled={loading}
                  className="ex-btn ex-btn-ghost w-full h-11"
                >
                  Set up admin with {oidcProvider || 'OIDC'}
                </button>
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-ex-divider" />
                  <span className="text-xs text-ex-text-subtle uppercase tracking-wider">or create local admin</span>
                  <div className="flex-1 h-px bg-ex-divider" />
                </div>
              </>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-xs font-semibold text-ex-text-muted mb-1.5">Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className="ex-input"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
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
                  autoComplete="new-password"
                  required
                  minLength={passwordPolicy.minLength}
                  maxLength={passwordPolicy.maxLength}
                  pattern={passwordPolicy.patternHtml}
                  className="ex-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <PasswordRequirements password={password} policy={passwordPolicy} />
              </div>
              {bootstrapRequired && (
                <div>
                  <label htmlFor="setupCode" className="block text-xs font-semibold text-ex-warning mb-1.5 uppercase tracking-wider">Bootstrap setup code</label>
                  <input
                    id="setupCode"
                    name="setupCode"
                    type="text"
                    autoComplete="one-time-code"
                    required
                    className="ex-input uppercase tracking-widest"
                    placeholder="One-time setup code"
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value.toUpperCase())}
                  />
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="ex-btn ex-btn-primary w-full h-11">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
