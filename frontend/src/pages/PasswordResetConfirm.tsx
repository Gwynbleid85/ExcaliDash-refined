import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { authPasswordResetConfirm, isAxiosError } from '../api';
import { getPasswordPolicy, validatePassword } from '../utils/passwordPolicy';
import { PasswordRequirements } from '../components/PasswordRequirements';

export const PasswordResetConfirm: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const passwordPolicy = getPasswordPolicy();

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const passwordError = validatePassword(password, passwordPolicy);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (!token) {
      setError('Invalid reset token');
      return;
    }

    setLoading(true);

    try {
      await authPasswordResetConfirm(token, password);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: unknown) {
      let message = 'Failed to reset password';
      if (isAxiosError(err)) {
        if (err.response?.status === 404) {
          message = 'Password reset feature is not enabled on this server';
        } else if (err.response?.data?.message) {
          message = err.response.data.message;
        } else if (err.response?.data?.error) {
          message = err.response.data.error;
        } else if (err.message) {
          message = err.message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ex-bg px-4 py-10">
        <div className="max-w-md w-full text-center">
          <Logo className="mx-auto h-12 w-auto" />
          <h2 className="ex-title mt-5 text-3xl">Password reset successful</h2>
          <p className="mt-2 text-sm text-ex-text-muted">
            Your password has been reset. Redirecting to login…
          </p>
          <div className="mt-6">
            <Link to="/login" className="text-sm font-semibold text-ex-primary hover:text-ex-primary-hover">
              Go to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ex-bg px-4 py-10">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Logo className="mx-auto h-12 w-auto" />
          <h2 className="ex-title mt-5 text-3xl">Set new password</h2>
          <p className="mt-2 text-sm text-ex-text-muted">Enter your new password below.</p>
        </div>

        <div className="ex-island p-6 sm:p-8">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-ex border border-ex-danger bg-ex-danger-soft p-3 text-sm text-ex-danger font-medium">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-ex-text-muted mb-1.5">New password</label>
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
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <PasswordRequirements password={password} policy={passwordPolicy} />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-semibold text-ex-text-muted mb-1.5">Confirm password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={passwordPolicy.minLength}
                  maxLength={passwordPolicy.maxLength}
                  className="ex-input"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" disabled={loading || !token} className="ex-btn ex-btn-primary w-full h-11">
              {loading ? 'Resetting…' : 'Reset password'}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-sm font-semibold text-ex-primary hover:text-ex-primary-hover">
                Back to login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
