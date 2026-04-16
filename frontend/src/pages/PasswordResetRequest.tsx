import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';

export const PasswordResetRequest: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ex-bg px-4 py-10">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Logo className="mx-auto h-12 w-auto" />
          <h2 className="ex-title mt-5 text-3xl">Password help</h2>
          <p className="mt-2 text-sm text-ex-text-muted">
            This server does not send password reset emails.
          </p>
        </div>
        <div className="ex-island p-6 sm:p-8 space-y-4 text-left">
          <div className="text-sm text-ex-text">
            Contact your administrator and ask them to generate a temporary password from the Admin dashboard.
          </div>
          <div className="text-xs text-ex-text-muted">
            If you are an admin and you're locked out, run:
          </div>
          <pre className="text-xs bg-ex-surface-muted border border-ex-border rounded-ex p-3 overflow-x-auto text-ex-text font-mono">
cd backend && node scripts/admin-recover.cjs --identifier you@example.com --generate --activate --disable-login-rate-limit
          </pre>
        </div>
        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm font-semibold text-ex-primary hover:text-ex-primary-hover">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};
