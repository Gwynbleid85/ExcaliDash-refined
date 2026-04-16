import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Shield, ShieldOff } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import { AuthStatusErrorPanel } from '../components/AuthStatusErrorPanel';

type Step = 'choice' | 'confirm-disable';

export const AuthSetupChoice: React.FC = () => {
  const navigate = useNavigate();
  const {
    loading: authLoading,
    authEnabled,
    authStatusError,
    retryAuthStatus,
    bootstrapRequired,
    isAuthenticated,
    authOnboardingRequired,
    authOnboardingMode,
  } = useAuth();

  const [step, setStep] = useState<Step>('choice');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authStatusError) return;
    if (authLoading || authEnabled === null) return;
    if (authOnboardingRequired) return;

    if (!authEnabled) {
      navigate('/', { replace: true });
      return;
    }

    if (bootstrapRequired) {
      navigate('/register', { replace: true });
      return;
    }

    if (isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }

    navigate('/login', { replace: true });
  }, [
    authEnabled,
    authLoading,
    authOnboardingRequired,
    authStatusError,
    bootstrapRequired,
    isAuthenticated,
    navigate,
  ]);

  const isMigrationMode = authOnboardingMode === 'migration';

  const applyChoice = async (enableAuth: boolean) => {
    setSubmitting(true);
    setError('');
    try {
      const response = await api.authOnboardingChoice(enableAuth);
      localStorage.setItem('excalidash-auth-enabled', String(response.authEnabled));

      if (response.authEnabled) {
        window.location.href = response.bootstrapRequired ? '/register' : '/login';
        return;
      }

      window.location.href = '/';
    } catch (err: unknown) {
      let message = 'Failed to apply authentication choice';
      if (api.isAxiosError(err)) {
        message = err.response?.data?.message || err.response?.data?.error || message;
      }
      setError(message);
      setSubmitting(false);
    }
  };

  if (authLoading || authEnabled === null || !authOnboardingRequired) {
    if (authStatusError) {
      return <AuthStatusErrorPanel message={authStatusError} onRetry={retryAuthStatus} fullScreen />;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-ex-bg px-4">
        <div className="text-ex-text-muted">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ex-bg px-4 py-10 flex items-center justify-center">
      <div className="mx-auto w-full max-w-2xl">
        <div className="text-center mb-8">
          <Logo className="mx-auto h-12 w-auto" />
          <h1 className="ex-title mt-5 text-2xl sm:text-3xl leading-tight">
            {step === 'choice' ? 'Choose authentication mode' : 'Keep authentication disabled?'}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-ex-text-muted">
            {step === 'choice'
              ? isMigrationMode
                ? 'We detected existing data from an earlier ExcaliDash version.'
                : 'This looks like a new ExcaliDash setup.'
              : 'This option is only recommended for private, trusted networks.'}
          </p>
        </div>

        <div className="ex-island p-6 sm:p-8">
          {error && (
            <div className="mb-5 rounded-ex border border-ex-danger bg-ex-danger-soft p-3 text-sm text-ex-danger font-medium">
              {error}
            </div>
          )}

          {step === 'choice' ? (
            <>
              <div className="mb-4 rounded-ex border border-ex-border bg-ex-surface-muted p-4 text-sm text-ex-text">
                <div className="font-semibold mb-1">Enable authentication now?</div>
                <div className="text-ex-text-muted">If enabled, users must sign in and you will set up the first admin account.</div>
              </div>

              <div className="mb-4 rounded-ex border border-ex-success bg-ex-success-soft p-3 text-sm text-ex-text">
                Recommendation: choose <strong>Enable Authentication</strong>.
              </div>

              {isMigrationMode && (
                <div className="mb-4 rounded-ex border border-ex-primary bg-ex-primary-soft p-3 text-sm text-ex-text">
                  ExcaliDash v0.4 adds multi-user and OIDC support. Enabling authentication secures upgraded instances before sharing access.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 mt-5">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void applyChoice(true)}
                  className="ex-btn ex-btn-primary h-11"
                >
                  <Shield size={16} />
                  Enable authentication
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setStep('confirm-disable')}
                  className="ex-btn ex-btn-ghost h-11"
                >
                  <ShieldOff size={16} />
                  Keep disabled
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-5 rounded-ex border border-ex-danger bg-ex-danger-soft p-4 text-sm text-ex-text">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-ex-danger" />
                  <div>
                    With authentication disabled, anyone who can access this instance can use all data and settings.
                    They can also enable authentication themselves and lock you out.
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setStep('choice')}
                  className="ex-btn ex-btn-ghost h-11"
                >
                  Go back
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void applyChoice(false)}
                  className="ex-btn ex-btn-danger h-11"
                >
                  Confirm disable authentication
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
