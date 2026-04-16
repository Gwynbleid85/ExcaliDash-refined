import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import * as api from '../api';
import type { Collection } from '../types';
import { Upload, Moon, Sun, Info, Archive, RefreshCw, Check } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { importLegacyFiles } from '../utils/importUtils';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

export const Settings: React.FC = () => {
    const [collections, setCollections] = useState<Collection[]>([]);
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const { authEnabled, user, authMode } = useAuth();

    const [legacyDbImportConfirmation, setLegacyDbImportConfirmation] = useState<{
        isOpen: boolean;
        file: File | null;
        info: null | {
            drawings: number;
            collections: number;
            legacyLatestMigration: string | null;
            currentLatestMigration: string | null;
        };
    }>({ isOpen: false, file: null, info: null });
    const [importError, setImportError] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });
    const [importSuccess, setImportSuccess] = useState<{ isOpen: boolean; message: React.ReactNode }>({ isOpen: false, message: '' });
    const [legacyDbImportLoading, setLegacyDbImportLoading] = useState(false);
    const [authToggleLoading, setAuthToggleLoading] = useState(false);
    const [authToggleError, setAuthToggleError] = useState<string | null>(null);
    const [authToggleConfirm, setAuthToggleConfirm] = useState<{ isOpen: boolean; nextEnabled: boolean | null }>({
        isOpen: false,
        nextEnabled: null,
    });
    const [authDisableFinalConfirmOpen, setAuthDisableFinalConfirmOpen] = useState(false);

    const [backupExportExt, setBackupExportExt] = useState<'excalidash' | 'excalidash.zip'>('excalidash');
    const [backupImportConfirmation, setBackupImportConfirmation] = useState<{
        isOpen: boolean;
        file: File | null;
        info: null | {
            formatVersion: number;
            exportedAt: string;
            excalidashBackendVersion: string | null;
            collections: number;
            drawings: number;
        };
    }>({ isOpen: false, file: null, info: null });
    const [backupImportLoading, setBackupImportLoading] = useState(false);
    const [backupImportSuccess, setBackupImportSuccess] = useState(false);
    const [backupImportError, setBackupImportError] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });

    const appVersion = import.meta.env.VITE_APP_VERSION || 'Unknown version';
    const buildLabel = import.meta.env.VITE_APP_BUILD_LABEL;
    const isManagedAuthMode = authMode !== 'local';

    const UPDATE_CHANNEL_KEY = 'excalidash-update-channel';
    const UPDATE_INFO_KEY = 'excalidash-update-info';
    const [updateChannel, setUpdateChannel] = useState<api.UpdateChannel>(() => {
        const raw = typeof window === 'undefined' ? null : window.localStorage?.getItem?.(UPDATE_CHANNEL_KEY) ?? null;
        return raw === 'prerelease' ? 'prerelease' : 'stable';
    });
    const [updateInfo, setUpdateInfo] = useState<api.UpdateInfo | null>(null);
    const [updateLoading, setUpdateLoading] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCollections = async () => {
            try {
                const data = await api.getCollections();
                setCollections(data);
            } catch (err) {
                console.error('Failed to fetch collections:', err);
            }
        };
        fetchCollections();
    }, []);

    const checkForUpdates = async (channel: api.UpdateChannel) => {
        setUpdateLoading(true);
        setUpdateError(null);
        try {
            const info = await api.getUpdateInfo(channel);
            setUpdateInfo(info);
            try {
                window.localStorage?.setItem?.(`${UPDATE_INFO_KEY}:${channel}`, JSON.stringify(info));
            } catch {
            }
        } catch (err: unknown) {
            let message = 'Failed to check for updates';
            if (api.isAxiosError(err)) {
                message =
                    err.response?.data?.message ||
                    err.response?.data?.error ||
                    message;
            }
            setUpdateError(message);
        } finally {
            setUpdateLoading(false);
        }
    };

    useEffect(() => {
        void checkForUpdates(updateChannel);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setAuthEnabled = async (enabled: boolean) => {
        setAuthToggleLoading(true);
        setAuthToggleError(null);
        try {
            const response = await api.api.post<{ authEnabled: boolean; bootstrapRequired?: boolean }>(
                '/auth/auth-enabled',
                { enabled },
            );

            if (response.data.authEnabled) {
                window.location.href = response.data.bootstrapRequired ? '/register' : '/login';
                return;
            }

            window.location.reload();
        } catch (err: unknown) {
            let message = 'Failed to update authentication setting';
            if (api.isAxiosError(err)) {
                message =
                    err.response?.data?.message ||
                    err.response?.data?.error ||
                    message;
            }
            setAuthToggleError(message);
        } finally {
            setAuthToggleLoading(false);
        }
    };

    const confirmToggleAuthEnabled = () => {
        if (authEnabled === null) return;
        if (authToggleLoading) return;
        setAuthToggleConfirm({ isOpen: true, nextEnabled: !authEnabled });
    };

    const exportBackup = async () => {
        try {
            const extQuery = backupExportExt === 'excalidash.zip' ? '?ext=zip' : '';
            const response = await api.api.get(`/export/excalidash${extQuery}`, { responseType: 'blob' });
            const blob = new Blob([response.data], { type: 'application/zip' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const date = new Date().toISOString().split('T')[0];
            link.download = backupExportExt === 'excalidash.zip'
                ? `excalidash-backup-${date}.excalidash.zip`
                : `excalidash-backup-${date}.excalidash`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err: unknown) {
            console.error('Backup export failed:', err);
            setBackupImportError({ isOpen: true, message: 'Failed to export backup. Please try again.' });
        }
    };

    const verifyBackupFile = async (file: File) => {
        setBackupImportLoading(true);
        try {
            const formData = new FormData();
            formData.append('archive', file);
            const response = await api.api.post<{
                valid: boolean;
                formatVersion: number;
                exportedAt: string;
                excalidashBackendVersion: string | null;
                collections: number;
                drawings: number;
            }>('/import/excalidash/verify', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setBackupImportConfirmation({
                isOpen: true,
                file,
                info: {
                    formatVersion: response.data.formatVersion,
                    exportedAt: response.data.exportedAt,
                    excalidashBackendVersion: response.data.excalidashBackendVersion ?? null,
                    collections: response.data.collections,
                    drawings: response.data.drawings,
                },
            });
        } catch (err: unknown) {
            console.error('Backup verify failed:', err);
            let message = 'Failed to verify backup file.';
            if (api.isAxiosError(err)) {
                message = err.response?.data?.message || err.response?.data?.error || message;
            }
            setBackupImportError({ isOpen: true, message });
        } finally {
            setBackupImportLoading(false);
        }
    };

    const verifyLegacyDbFile = async (file: File) => {
        setLegacyDbImportLoading(true);
        try {
            const formData = new FormData();
            formData.append('db', file);
            const response = await api.api.post<{
                valid: boolean;
                drawings: number;
                collections: number;
                latestMigration: string | null;
                currentLatestMigration: string | null;
            }>('/import/sqlite/legacy/verify', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setLegacyDbImportConfirmation({
                isOpen: true,
                file,
                info: {
                    drawings: response.data.drawings,
                    collections: response.data.collections,
                    legacyLatestMigration: response.data.latestMigration ?? null,
                    currentLatestMigration: response.data.currentLatestMigration ?? null,
                },
            });
        } catch (err: unknown) {
            console.error('Legacy DB verify failed:', err);
            let message = 'Failed to verify legacy database file.';
            if (api.isAxiosError(err)) {
                message = err.response?.data?.message || err.response?.data?.error || message;
            }
            setImportError({ isOpen: true, message });
        } finally {
            setLegacyDbImportLoading(false);
        }
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

    const handleSelectCollection = (id: string | null | undefined) => {
        if (id === undefined) navigate('/');
        else if (id === null) navigate('/collections?id=unorganized');
        else navigate(`/collections?id=${id}`);
    };



    return (
        <Layout
            collections={collections}
            selectedCollectionId="SETTINGS"
            onSelectCollection={handleSelectCollection}
            onCreateCollection={handleCreateCollection}
            onEditCollection={handleEditCollection}
            onDeleteCollection={handleDeleteCollection}
        >
            <h1 className="ex-title text-3xl sm:text-4xl lg:text-5xl mb-6 lg:mb-8 pl-1">
                Settings
            </h1>

            {authToggleError && (
                <div className="mb-6 p-3 rounded-ex border border-ex-danger bg-ex-danger-soft text-sm font-medium text-ex-danger">
                    {authToggleError}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="ex-island flex flex-col items-center justify-center gap-3 p-6">
                    <div className="w-14 h-14 bg-ex-primary-soft rounded-ex flex items-center justify-center">
                        <Archive size={24} className="text-ex-primary" />
                    </div>
                    <div className="text-center">
                        <h3 className="ex-title text-lg mb-1">Export backup</h3>
                        <p className="text-xs text-ex-text-muted max-w-[220px] mx-auto">
                            Download a <code>.excalidash</code> archive organized by collections
                        </p>
                    </div>
                    <div className="w-full flex flex-col items-stretch gap-2 pt-2">
                        <button onClick={exportBackup} className="ex-btn ex-btn-primary w-full">
                            Export
                        </button>
                        <select
                            value={backupExportExt}
                            onChange={(e) => setBackupExportExt(e.target.value as any)}
                            className="ex-input"
                            title="Download name"
                        >
                            <option value="excalidash">.excalidash</option>
                            <option value="excalidash.zip">.excalidash.zip</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={toggleTheme}
                    className="ex-island ex-card-interactive flex flex-col items-center justify-center gap-3 p-6 text-left"
                >
                    <div className="w-14 h-14 bg-ex-warning-soft rounded-ex flex items-center justify-center">
                        {theme === 'light' ? (
                            <Moon size={24} className="text-ex-warning" />
                        ) : (
                            <Sun size={24} className="text-ex-warning" />
                        )}
                    </div>
                    <div className="text-center">
                        <h3 className="ex-title text-lg mb-1">
                            {theme === 'light' ? 'Dark mode' : 'Light mode'}
                        </h3>
                        <p className="text-xs text-ex-text-muted max-w-[220px] mx-auto">
                            Switch to {theme === 'light' ? 'dark' : 'light'} theme
                        </p>
                    </div>
                </button>

                <div className="ex-island flex flex-col p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-14 h-14 flex-shrink-0 bg-ex-success-soft rounded-ex flex items-center justify-center">
                            <RefreshCw size={24} className={clsx('text-ex-success', updateLoading && 'animate-spin')} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="ex-title text-xl truncate">Updates</h3>
                        </div>
                    </div>

                    <div className="space-y-3 flex-1">
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-ex-text-subtle" htmlFor="settings-update-channel">
                                    Channel
                                </label>
                                <span className={clsx(
                                    'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border',
                                    updateChannel === 'stable'
                                        ? 'bg-ex-success-soft text-ex-success border-ex-success'
                                        : 'bg-ex-warning-soft text-ex-warning border-ex-warning'
                                )}>
                                    {updateChannel}
                                </span>
                            </div>
                            <select
                                id="settings-update-channel"
                                value={updateChannel}
                                onChange={(e) => {
                                    const next = (e.target.value === 'prerelease' ? 'prerelease' : 'stable') as api.UpdateChannel;
                                    try {
                                        window.localStorage?.setItem?.(UPDATE_CHANNEL_KEY, next);
                                    } catch {
                                    }
                                    setUpdateChannel(next);
                                    void checkForUpdates(next);
                                }}
                                className="ex-input"
                            >
                                <option value="stable">Stable</option>
                                <option value="prerelease">Prerelease</option>
                            </select>
                        </div>

                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-ex-text-subtle mb-1.5">Current status</div>
                            <div className={clsx(
                                'px-3 py-2.5 rounded-ex border font-medium text-sm flex items-center gap-2',
                                updateInfo?.outboundEnabled === false ? 'bg-ex-surface-muted border-ex-border text-ex-text-muted' :
                                updateLoading ? 'bg-ex-primary-soft border-ex-primary text-ex-primary' :
                                updateInfo?.isUpdateAvailable ? 'bg-ex-success-soft border-ex-success text-ex-success' :
                                updateError ? 'bg-ex-danger-soft border-ex-danger text-ex-danger' :
                                'bg-ex-surface-muted border-ex-border text-ex-text'
                            )}>
                                {updateLoading && <RefreshCw size={14} className="animate-spin flex-shrink-0" />}
                                <span className="truncate">
                                    {updateInfo?.outboundEnabled === false ? 'Checks disabled' :
                                     updateLoading ? 'Checking…' :
                                     updateInfo?.isUpdateAvailable ? `v${updateInfo.latestVersion} available` :
                                     updateInfo?.latestVersion ? (
                                        <span className="flex items-center gap-1.5">
                                            <Check size={14} strokeWidth={2.5} className="text-ex-success flex-shrink-0" />
                                            Up to date
                                        </span>
                                     ) :
                                     updateError ? updateError :
                                     'Status unknown'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2">
                        <button
                            onClick={() => void checkForUpdates(updateChannel)}
                            disabled={updateLoading}
                            className="ex-btn ex-btn-ghost"
                            type="button"
                        >
                            Check now
                        </button>

                        <a
                            href="https://github.com/ZimengXiong/ExcaliDash/releases"
                            target="_blank"
                            rel="noreferrer"
                            className="ex-btn ex-btn-primary"
                        >
                            Releases
                        </a>
                    </div>

                    {updateInfo?.error && !updateLoading && (
                        <div className="mt-3 p-2 rounded-ex-sm bg-ex-danger-soft border border-ex-danger text-[11px] font-medium text-ex-danger">
                            Error: {updateInfo.error}
                        </div>
                    )}
                </div>
            </div>

            <details className="mt-8 ex-panel p-5">
                <summary className="cursor-pointer select-none font-semibold text-ex-text">
                    Advanced / Legacy
                </summary>
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    <div className="relative">
                        <input
                            type="file"
                            accept=".excalidash,.zip"
                            className="hidden"
                            id="settings-import-backup"
                            onChange={async (e) => {
                                const file = (e.target.files || [])[0];
                                if (!file) return;
                                await verifyBackupFile(file);
                                e.target.value = '';
                            }}
                        />
                        <button
                            onClick={() => document.getElementById('settings-import-backup')?.click()}
                            disabled={backupImportLoading}
                            className="ex-island ex-card-interactive w-full h-full flex flex-col items-center gap-3 p-6 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="w-14 h-14 bg-ex-primary-soft rounded-ex flex items-center justify-center">
                                <Upload size={24} className="text-ex-primary" />
                            </div>
                            <div className="text-center">
                                <h3 className="ex-title text-lg mb-1">
                                    {backupImportLoading ? 'Verifying…' : 'Import backup'}
                                </h3>
                                <p className="text-xs text-ex-text-muted max-w-[220px] mx-auto">
                                    Merge-import a <code>.excalidash</code> backup into your account
                                </p>
                            </div>
                        </button>
                    </div>

                    <button
                        onClick={confirmToggleAuthEnabled}
                        disabled={
                            isManagedAuthMode ||
                            authEnabled === null ||
                            authToggleLoading ||
                            (authEnabled === true && user?.role !== 'ADMIN')
                        }
                        className="ex-island ex-card-interactive w-full flex flex-col items-center gap-3 p-6 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                    >
                        <div className="w-14 h-14 bg-ex-surface-muted rounded-ex flex items-center justify-center border border-ex-border">
                            <Info size={24} className="text-ex-text-muted" />
                        </div>
                        <div className="text-center">
                            <h3 className="ex-title text-lg mb-1">
                                {authEnabled ? 'Authentication: On' : 'Authentication: Off'}
                            </h3>
                            <p className="text-xs text-ex-text-muted max-w-[220px] mx-auto">
                                {isManagedAuthMode
                                    ? `Managed by AUTH_MODE=${authMode}`
                                    : authEnabled
                                        ? user?.role === 'ADMIN'
                                            ? (authToggleLoading ? 'Disabling…' : 'Disable multi-user login')
                                            : 'Only admins can disable'
                                        : authToggleLoading
                                            ? 'Enabling…'
                                            : 'Enable multi-user login'}
                            </p>
                        </div>
                    </button>

                    <div className="relative">
                        <input
                            type="file"
                            multiple
                            accept=".sqlite,.db,.json,.excalidraw,.zip"
                            className="hidden"
                            id="settings-import-legacy"
                            onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length === 0) return;

                                const databaseFile = files.find(f => f.name.endsWith('.sqlite') || f.name.endsWith('.db'));
                                if (databaseFile) {
                                    if (files.length > 1) {
                                        setImportError({ isOpen: true, message: 'Please import legacy database files separately from other files.' });
                                        e.target.value = '';
                                        return;
                                    }

                                    await verifyLegacyDbFile(databaseFile);
                                    e.target.value = '';
                                    return;
                                }

                                const result = await importLegacyFiles(files, null, () => { });

                                if (result.failed > 0) {
                                    setImportError({
                                        isOpen: true,
                                        message: `Import complete with errors.\nSuccess: ${result.success}\nFailed: ${result.failed}\nErrors:\n${result.errors.join('\n')}`
                                    });
                                } else {
                                    setImportSuccess({ isOpen: true, message: `Imported ${result.success} file(s).` });
                                }

                                e.target.value = '';
                            }}
                        />
                        <button
                            onClick={() => document.getElementById('settings-import-legacy')?.click()}
                            disabled={legacyDbImportLoading}
                            className="ex-island ex-card-interactive w-full h-full flex flex-col items-center gap-3 p-6"
                        >
                            <div className="w-14 h-14 bg-ex-warning-soft rounded-ex flex items-center justify-center">
                                <Upload size={24} className="text-ex-warning" />
                            </div>
                            <div className="text-center">
                                <h3 className="ex-title text-lg mb-1">Legacy import</h3>
                                <p className="text-xs text-ex-text-muted max-w-[220px] mx-auto">
                                    Import <code>.excalidraw</code>, legacy JSON, or merge a legacy <code>.db</code>
                                </p>
                            </div>
                        </button>
                    </div>

                    <div className="ex-island flex flex-col items-center gap-3 p-6">
                        <div className="w-14 h-14 bg-ex-surface-muted rounded-ex flex items-center justify-center border border-ex-border">
                            <Info size={24} className="text-ex-text-muted" />
                        </div>
                        <div className="text-center">
                            <h3 className="ex-title text-lg mb-1">Version info</h3>
                            <div className="text-xs flex flex-col items-center gap-1">
                                <span className="text-sm sm:text-base font-semibold text-ex-text">{appVersion}</span>
                                {buildLabel && (
                                    <span className="uppercase tracking-wide text-ex-danger font-semibold">{buildLabel}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </details>

            <ConfirmModal
                isOpen={legacyDbImportConfirmation.isOpen}
                title="Merge-import legacy database?"
                message={
                    <div className="space-y-2">
                        <div>This will merge legacy data into your account (it will not replace the server database).</div>
                        {legacyDbImportConfirmation.info && (
                            <div className="text-sm text-slate-700 dark:text-neutral-200 space-y-1">
                                <div>Drawings: {legacyDbImportConfirmation.info.drawings}</div>
                                <div>Collections: {legacyDbImportConfirmation.info.collections}</div>
                                <div>Legacy migration: {legacyDbImportConfirmation.info.legacyLatestMigration || 'Unknown'}</div>
                                <div>Current migration: {legacyDbImportConfirmation.info.currentLatestMigration || 'Unknown'}</div>
                            </div>
                        )}
                    </div>
                }
                confirmText="Merge Import"
                cancelText="Cancel"
                onConfirm={async () => {
                    const file = legacyDbImportConfirmation.file;
                    if (!file) return;
                    setLegacyDbImportConfirmation({ isOpen: false, file: null, info: null });

                    const formData = new FormData();
                    formData.append('db', file);

                    try {
                        const response = await api.api.post<{
                            success: boolean;
                            collections: { created: number; updated: number; idConflicts: number };
                            drawings: { created: number; updated: number; idConflicts: number };
                        }>('/import/sqlite/legacy', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' },
                        });

                        setImportSuccess({
                            isOpen: true,
                            message: `Legacy DB imported. Collections: +${response.data.collections.created} / ~${response.data.collections.updated}. Drawings: +${response.data.drawings.created} / ~${response.data.drawings.updated}.`,
                        });
                    } catch (err: unknown) {
                        console.error(err);
                        let message = 'Failed to import legacy database.';
                        if (api.isAxiosError(err)) {
                            message = err.response?.data?.message || err.response?.data?.error || message;
                        }
                        setImportError({ isOpen: true, message });
                    }
                }}
                onCancel={() => setLegacyDbImportConfirmation({ isOpen: false, file: null, info: null })}
            />

            <ConfirmModal
                isOpen={importError.isOpen}
                title="Import Failed"
                message={importError.message}
                confirmText="OK"
                cancelText=""
                showCancel={false}
                isDangerous={false}
                onConfirm={() => setImportError({ isOpen: false, message: '' })}
                onCancel={() => setImportError({ isOpen: false, message: '' })}
            />

            <ConfirmModal
                isOpen={importSuccess.isOpen}
                title="Import Successful"
                message={importSuccess.message}
                confirmText="OK"
                showCancel={false}
                isDangerous={false}
                variant="success"
                onConfirm={() => setImportSuccess({ isOpen: false, message: '' })}
                onCancel={() => setImportSuccess({ isOpen: false, message: '' })}
            />

            <ConfirmModal
                isOpen={authToggleConfirm.isOpen}
                title={authToggleConfirm.nextEnabled ? 'Enable authentication?' : 'Disable authentication?'}
                message={
                    authToggleConfirm.nextEnabled
                        ? 'This will require users to sign in. You will be prompted to set up an admin account immediately.'
                        : (
                            <div className="space-y-2 text-left">
                                <div>
                                    This will turn off authentication for the entire instance.
                                </div>
                                <div className="font-semibold text-rose-700 dark:text-rose-300">
                                    Recommendation: keep authentication enabled unless this instance is fully private.
                                </div>
                            </div>
                        )
                }
                confirmText={authToggleConfirm.nextEnabled ? 'Enable' : 'Continue'}
                cancelText="Cancel"
                isDangerous={!authToggleConfirm.nextEnabled}
                onConfirm={async () => {
                    const nextEnabled = authToggleConfirm.nextEnabled;
                    setAuthToggleConfirm({ isOpen: false, nextEnabled: null });
                    if (typeof nextEnabled !== 'boolean') return;
                    if (!nextEnabled) {
                        setAuthDisableFinalConfirmOpen(true);
                        return;
                    }
                    await setAuthEnabled(nextEnabled);
                }}
                onCancel={() => setAuthToggleConfirm({ isOpen: false, nextEnabled: null })}
            />

            <ConfirmModal
                isOpen={authDisableFinalConfirmOpen}
                title="Final warning: disable authentication?"
                message={
                    <div className="space-y-2 text-left">
                        <div>
                            With authentication off, any user who can access this URL can view and modify all drawings and settings. They can also turn authentication back on and lock you out.
                        </div>
                        <div className="font-semibold text-rose-700 dark:text-rose-300">
                            This is only safe on a trusted private network.
                        </div>
                    </div>
                }
                confirmText="Disable Authentication"
                cancelText="Keep Enabled (Recommended)"
                isDangerous
                onConfirm={async () => {
                    setAuthDisableFinalConfirmOpen(false);
                    await setAuthEnabled(false);
                }}
                onCancel={() => setAuthDisableFinalConfirmOpen(false)}
            />

            <ConfirmModal
                isOpen={backupImportConfirmation.isOpen}
                title="Import backup?"
                message={
                    backupImportConfirmation.info
                        ? `This will merge ${backupImportConfirmation.info.collections} collection(s) and ${backupImportConfirmation.info.drawings} drawing(s) from a Format v${backupImportConfirmation.info.formatVersion} backup exported at ${backupImportConfirmation.info.exportedAt}.`
                        : 'This will merge the backup into your account.'
                }
                confirmText="Import"
                cancelText="Cancel"
                isDangerous={false}
                onConfirm={async () => {
                    const file = backupImportConfirmation.file;
                    if (!file) return;
                    setBackupImportConfirmation({ ...backupImportConfirmation, isOpen: false });
                    setBackupImportLoading(true);
                    try {
                        const formData = new FormData();
                        formData.append('archive', file);
                        await api.api.post('/import/excalidash', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' },
                        });
                        setBackupImportConfirmation({ isOpen: false, file: null, info: null });
                        setBackupImportSuccess(true);
                    } catch (err: unknown) {
                        console.error('Backup import failed:', err);
                        let message = 'Failed to import backup.';
                        if (api.isAxiosError(err)) {
                            message = err.response?.data?.message || err.response?.data?.error || message;
                        }
                        setBackupImportError({ isOpen: true, message });
                        setBackupImportConfirmation({ isOpen: false, file: null, info: null });
                    } finally {
                        setBackupImportLoading(false);
                    }
                }}
                onCancel={() => setBackupImportConfirmation({ isOpen: false, file: null, info: null })}
            />

            <ConfirmModal
                isOpen={backupImportSuccess}
                title="Backup Imported"
                message="Backup imported successfully."
                confirmText="OK"
                showCancel={false}
                isDangerous={false}
                variant="success"
                onConfirm={() => setBackupImportSuccess(false)}
                onCancel={() => setBackupImportSuccess(false)}
            />

            <ConfirmModal
                isOpen={backupImportError.isOpen}
                title="Backup Import Failed"
                message={backupImportError.message}
                confirmText="OK"
                cancelText=""
                showCancel={false}
                isDangerous={false}
                onConfirm={() => setBackupImportError({ isOpen: false, message: '' })}
                onCancel={() => setBackupImportError({ isOpen: false, message: '' })}
            />
        </Layout >
    );
};
