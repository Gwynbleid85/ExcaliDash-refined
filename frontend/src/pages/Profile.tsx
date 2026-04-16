import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import type { Collection } from '../types';
import { User, Lock, Save, X } from 'lucide-react';
import { USER_KEY } from '../utils/impersonation';
import { getPasswordPolicy, validatePassword } from '../utils/passwordPolicy';
import { PasswordRequirements } from '../components/PasswordRequirements';

export const Profile: React.FC = () => {
    const { user: authUser, logout, authEnabled } = useAuth();
    const navigate = useNavigate();
    const mustResetPassword = Boolean(authUser?.mustResetPassword);
    const passwordPolicy = getPasswordPolicy();
    const [collections, setCollections] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswordForm, setShowPasswordForm] = useState(false);

    useEffect(() => {
        if (authEnabled === false) {
            navigate('/settings', { replace: true });
            return;
        }
        const fetchData = async () => {
            try {
                const collectionsData = await api.getCollections();
                setCollections(collectionsData);
                
                if (authUser) {
                    setName(authUser.name);
                    setEmail(authUser.email);
                }
            } catch (err) {
                console.error('Failed to fetch data:', err);
            }
        };
        fetchData();
    }, [authEnabled, authUser, navigate]);

    useEffect(() => {
        if (mustResetPassword) {
            setShowPasswordForm(true);
        }
    }, [mustResetPassword]);

    const handleSelectCollection = (id: string | null | undefined) => {
        if (id === undefined) navigate('/');
        else if (id === null) navigate('/collections?id=unorganized');
        else navigate(`/collections?id=${id}`);
    };

    const handleCreateCollection = async (name: string) => {
        await api.createCollection(name);
        const newCollections = await api.getCollections();
        setCollections(newCollections);
    };

    const handleEditCollection = async (id: string, name: string) => {
        setCollections(prev => prev.map(c => c.id === id ? { ...c, name } : c));
        await api.updateCollection(id, name);
    };

    const handleDeleteCollection = async (id: string) => {
        setCollections(prev => prev.filter(c => c.id !== id));
        await api.deleteCollection(id);
    };

    const handleUpdateName = async () => {
        if (mustResetPassword) {
            setError('You must reset your password before updating your profile');
            return;
        }
        if (!name.trim()) {
            setError('Name cannot be empty');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await api.api.put<{ user: { id: string; email: string; name: string; createdAt: string; updatedAt: string } }>('/auth/profile', { name: name.trim() });
            setSuccess('Name updated successfully');
            if (response.data?.user) {
                localStorage.setItem('excalidash-user', JSON.stringify(response.data.user));
                setTimeout(() => window.location.reload(), 500);
            }
        } catch (err: unknown) {
            let message = 'Failed to update name';
            if (api.isAxiosError(err)) {
                if (err.response?.data?.message) {
                    message = err.response.data.message;
                } else if (err.response?.data?.error) {
                    message = err.response.data.error;
                }
            }
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('All password fields are required');
            return;
        }

        const passwordError = validatePassword(newPassword, passwordPolicy);
        if (passwordError) {
            setError(passwordError);
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            await api.api.post('/auth/change-password', {
                currentPassword,
                newPassword,
            });
            setSuccess('Password changed successfully');
            setShowPasswordForm(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => {
                logout();
                navigate('/login');
            }, 2000);
        } catch (err: unknown) {
            let message = 'Failed to change password';
            if (api.isAxiosError(err)) {
                if (err.response?.data?.message) {
                    message = err.response.data.message;
                } else if (err.response?.data?.error) {
                    message = err.response.data.error;
                }
            }
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateEmail = async () => {
        if (mustResetPassword) {
            setError('You must reset your password before changing your email');
            return;
        }
        if (!email.trim()) {
            setError('Email cannot be empty');
            return;
        }
        if (!emailCurrentPassword) {
            setError('Current password is required to change email');
            return;
        }

        setEmailLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await api.api.put<{
                user: { id: string; email: string; name: string; createdAt: string; updatedAt: string };
            }>('/auth/email', {
                email: email.trim(),
                currentPassword: emailCurrentPassword,
            });

            localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));

            setSuccess('Email updated successfully');
            setShowEmailForm(false);
            setEmailCurrentPassword('');

            setTimeout(() => window.location.reload(), 500);
        } catch (err: unknown) {
            let message = 'Failed to update email';
            if (api.isAxiosError(err)) {
                if (err.response?.data?.message) {
                    message = err.response.data.message;
                } else if (err.response?.data?.error) {
                    message = err.response.data.error;
                }
            }
            setError(message);
        } finally {
            setEmailLoading(false);
        }
    };

    return (
        <Layout
            collections={collections}
            selectedCollectionId="PROFILE"
            onSelectCollection={handleSelectCollection}
            onCreateCollection={handleCreateCollection}
            onEditCollection={handleEditCollection}
            onDeleteCollection={handleDeleteCollection}
        >
            <h1 className="ex-title text-3xl sm:text-5xl mb-6 sm:mb-8 pl-1">
                Profile
            </h1>

            {success && (
                <div className="mb-6 p-3 rounded-ex border border-ex-success bg-ex-success-soft text-sm font-medium text-ex-success">
                    {success}
                </div>
            )}
            {error && (
                <div className="mb-6 p-3 rounded-ex border border-ex-danger bg-ex-danger-soft text-sm font-medium text-ex-danger">
                    {error}
                </div>
            )}

            <div className="space-y-6">
                <div className="ex-island p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-11 h-11 bg-ex-primary-soft rounded-ex flex items-center justify-center">
                            <User size={22} className="text-ex-primary" />
                        </div>
                        <h2 className="ex-title text-2xl">Personal information</h2>
                    </div>

                    {mustResetPassword && (
                        <div className="p-3 mb-4 rounded-ex border border-ex-warning bg-ex-warning-soft">
                            <p className="text-ex-text font-semibold">Password reset required</p>
                            <p className="text-sm text-ex-text-muted mt-1">
                                Change your password below before using ExcaliDash.
                            </p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-xs font-semibold text-ex-text-muted mb-1.5">
                                Email address
                            </label>
                            <div className="flex gap-2">
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={!showEmailForm}
                                    className="ex-input"
                                />
                                {!showEmailForm && (
                                    <button
                                        onClick={() => {
                                            setShowEmailForm(true);
                                            setEmailCurrentPassword('');
                                            setError('');
                                            setSuccess('');
                                        }}
                                        disabled={mustResetPassword}
                                        className="ex-btn ex-btn-ghost"
                                    >
                                        Change
                                    </button>
                                )}
                            </div>

                            {showEmailForm && (
                                <div className="mt-3 space-y-3">
                                    <div>
                                        <label htmlFor="emailCurrentPassword" className="block text-xs font-semibold text-ex-text-muted mb-1.5">
                                            Current password
                                        </label>
                                        <input
                                            id="emailCurrentPassword"
                                            type="password"
                                            value={emailCurrentPassword}
                                            onChange={(e) => setEmailCurrentPassword(e.target.value)}
                                            className="ex-input"
                                            placeholder="Enter current password"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleUpdateEmail}
                                            disabled={emailLoading || !email.trim() || !emailCurrentPassword || email.trim() === authUser?.email}
                                            className="ex-btn ex-btn-primary flex-1"
                                        >
                                            {emailLoading ? 'Saving…' : 'Save email'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowEmailForm(false);
                                                setEmail(authUser?.email || '');
                                                setEmailCurrentPassword('');
                                                setError('');
                                            }}
                                            disabled={emailLoading}
                                            className="ex-btn ex-btn-ghost"
                                        >
                                            <X size={16} />
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="name" className="block text-xs font-semibold text-ex-text-muted mb-1.5">
                                Display name
                            </label>
                            <div className="flex gap-2">
                                <input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="ex-input"
                                    placeholder="Your name"
                                />
                                <button
                                    onClick={handleUpdateName}
                                    disabled={mustResetPassword || loading || !name.trim() || name === authUser?.name}
                                    className="ex-btn ex-btn-primary"
                                >
                                    <Save size={16} />
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="ex-island p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-ex-danger-soft rounded-ex flex items-center justify-center">
                                <Lock size={22} className="text-ex-danger" />
                            </div>
                            <h2 className="ex-title text-2xl">Change password</h2>
                        </div>
                        {!showPasswordForm && !mustResetPassword && (
                            <button
                                onClick={() => setShowPasswordForm(true)}
                                className="ex-btn ex-btn-danger-ghost"
                            >
                                Change password
                            </button>
                        )}
                    </div>

                    {showPasswordForm && (
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="currentPassword" className="block text-xs font-semibold text-ex-text-muted mb-1.5">
                                    Current password
                                </label>
                                <input
                                    id="currentPassword"
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="ex-input"
                                    placeholder="Enter current password"
                                />
                            </div>

                            <div>
                                <label htmlFor="newPassword" className="block text-xs font-semibold text-ex-text-muted mb-1.5">
                                    New password
                                </label>
                                <input
                                    id="newPassword"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    minLength={passwordPolicy.minLength}
                                    maxLength={passwordPolicy.maxLength}
                                    pattern={passwordPolicy.patternHtml}
                                    className="ex-input"
                                    placeholder="Enter new password"
                                />
                                <PasswordRequirements password={newPassword} policy={passwordPolicy} />
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className="block text-xs font-semibold text-ex-text-muted mb-1.5">
                                    Confirm new password
                                </label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    minLength={passwordPolicy.minLength}
                                    maxLength={passwordPolicy.maxLength}
                                    className="ex-input"
                                    placeholder="Confirm new password"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={handleChangePassword}
                                    disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                                    className="ex-btn ex-btn-danger flex-1"
                                >
                                    {loading ? 'Changing…' : 'Change password'}
                                </button>
                                {!mustResetPassword && (
                                    <button
                                        onClick={() => {
                                            setShowPasswordForm(false);
                                            setCurrentPassword('');
                                            setNewPassword('');
                                            setConfirmPassword('');
                                            setError('');
                                        }}
                                        disabled={loading}
                                        className="ex-btn ex-btn-ghost"
                                    >
                                        <X size={16} />
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};
