import React from 'react';
import { Shield, LogIn, KeyRound } from 'lucide-react';
import type { AdminUser } from './types';

type UsersTableProps = {
  users: AdminUser[];
  loading: boolean;
  currentUserId?: string;
  resetPasswordLoadingId: string | null;
  onRoleChange: (user: AdminUser, role: string) => void;
  onToggleActive: (user: AdminUser) => void;
  onToggleMustReset: (user: AdminUser) => void;
  onImpersonate: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void | Promise<void>;
};

export const UsersTable: React.FC<UsersTableProps> = ({
  users,
  loading,
  currentUserId,
  resetPasswordLoadingId,
  onRoleChange,
  onToggleActive,
  onToggleMustReset,
  onImpersonate,
  onResetPassword,
}) => (
  <div className="ex-island overflow-hidden">
    <div className="px-5 py-4 border-b border-ex-divider flex items-center gap-3">
      <div className="w-10 h-10 bg-ex-primary-soft rounded-ex flex items-center justify-center">
        <Shield size={20} className="text-ex-primary" />
      </div>
      <h2 className="ex-title text-xl">Users</h2>
      {loading && <span className="text-sm text-ex-text-muted">Loading…</span>}
    </div>

    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-ex-surface-muted">
          <tr className="text-left">
            <th className="px-5 py-3 font-semibold text-ex-text-muted text-xs uppercase tracking-wider">User</th>
            <th className="px-5 py-3 font-semibold text-ex-text-muted text-xs uppercase tracking-wider">Role</th>
            <th className="px-5 py-3 font-semibold text-ex-text-muted text-xs uppercase tracking-wider">Active</th>
            <th className="px-5 py-3 font-semibold text-ex-text-muted text-xs uppercase tracking-wider">Must reset</th>
            <th className="px-5 py-3 font-semibold text-ex-text-muted text-xs uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-t border-ex-divider">
              <td className="px-5 py-4 min-w-[220px]">
                <div className="font-semibold text-ex-text truncate">{user.name}</div>
                <div className="text-ex-text-muted truncate">{user.email}</div>
                {user.username && (
                  <div className="text-xs text-ex-text-subtle">@{user.username}</div>
                )}
              </td>
              <td className="px-5 py-4">
                <select
                  value={user.role}
                  onChange={(event) => onRoleChange(user, event.target.value)}
                  disabled={user.id === currentUserId}
                  className="ex-input w-auto"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </td>
              <td className="px-5 py-4">
                <button
                  onClick={() => onToggleActive(user)}
                  disabled={user.id === currentUserId}
                  className={`inline-flex items-center gap-2 h-9 px-3 rounded-ex border font-medium text-sm transition-colors ${
                    user.isActive
                      ? 'border-ex-success bg-ex-success-soft text-ex-success'
                      : 'border-ex-border bg-ex-surface text-ex-text hover:bg-ex-surface-hover'
                  }`}
                >
                  {user.isActive ? 'Active' : 'Inactive'}
                </button>
              </td>
              <td className="px-5 py-4">
                <button
                  onClick={() => onToggleMustReset(user)}
                  className={`inline-flex items-center gap-2 h-9 px-3 rounded-ex border font-medium text-sm transition-colors ${
                    user.mustResetPassword
                      ? 'border-ex-warning bg-ex-warning-soft text-ex-warning'
                      : 'border-ex-border bg-ex-surface text-ex-text hover:bg-ex-surface-hover'
                  }`}
                >
                  {user.mustResetPassword ? 'Yes' : 'No'}
                </button>
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => onImpersonate(user)}
                    className="ex-btn ex-btn-ghost"
                  >
                    <LogIn size={16} />
                    Impersonate
                  </button>
                  <button
                    onClick={() => void onResetPassword(user)}
                    disabled={user.id === currentUserId || resetPasswordLoadingId === user.id}
                    className="ex-btn ex-btn-ghost"
                    title={
                      user.id === currentUserId
                        ? 'Use Profile → Change Password for your own account'
                        : 'Generate a temporary password'
                    }
                  >
                    <KeyRound size={16} />
                    {resetPasswordLoadingId === user.id ? 'Generating…' : 'Reset password'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && !loading && (
            <tr>
              <td colSpan={5} className="px-5 py-8 text-ex-text-muted text-center">
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);
