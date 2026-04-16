import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import clsx from "clsx";
import {
  X,
  Plus,
  Link as LinkIcon,
  AlertTriangle,
  Globe,
  Lock,
  ChevronDown,
  Calendar,
  Shield,
  Check,
  RefreshCw,
  Search,
} from "lucide-react";
import * as api from "../api";
import { useAuth } from "../context/AuthContext";

type Props = {
  drawingId: string;
  drawingName: string;
  isOpen: boolean;
  onClose: () => void;
};

const toIsoFromDatetimeLocal = (value: string): string | undefined => {
  const trimmed = (value || "").trim();
  if (!trimmed) return undefined;
  const date = new Date(trimmed);
  if (!Number.isFinite(date.getTime())) return undefined;
  return date.toISOString();
};

const EXPIRY_OPTIONS = [
  { label: "Disable in 1 hour", value: "1h" },
  { label: "Disable in 1 day", value: "1d" },
  { label: "Disable in 2 days", value: "2d" },
  { label: "Disable in 7 days", value: "7d" },
  { label: "Disable in 30 days", value: "30d" },
  { label: "Never auto-disable", value: "never" },
  { label: "Disable at...", value: "custom" },
];

const calculateExpiresAt = (option: string, customDate?: string): string | undefined => {
  if (option === "never") return undefined;
  if (option === "custom") return toIsoFromDatetimeLocal(customDate || "");

  const now = new Date();
  switch (option) {
    case "1h": now.setHours(now.getHours() + 1); break;
    case "1d": now.setDate(now.getDate() + 1); break;
    case "2d": now.setDate(now.getDate() + 2); break;
    case "7d": now.setDate(now.getDate() + 7); break;
    case "30d": now.setDate(now.getDate() + 30); break;
    default: return undefined;
  }
  return now.toISOString();
};

const CustomSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string; danger?: boolean }[];
  className?: string;
  icon?: React.ReactNode;
  align?: "left" | "right";
  showCheck?: boolean;
  variant?: "ghost" | "bordered";
}> = ({ value, onChange, options, className, icon, align = "left", showCheck = true, variant = "ghost" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const currentOption = options.find(o => o.value === value) || options[0];

  return (
    <div className={clsx('relative inline-flex items-center', className)} ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 h-9 rounded-ex text-sm font-semibold outline-none transition-colors',
          variant === 'bordered'
            ? 'border border-ex-border bg-ex-surface text-ex-text hover:bg-ex-surface-hover hover:border-ex-border-strong'
            : 'text-ex-text hover:bg-ex-surface-hover'
        )}
      >
        {icon}
        <span>{currentOption.label}</span>
        <ChevronDown size={14} className={clsx('transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div
          className={clsx(
            'absolute top-full z-[100] mt-1.5 min-w-[180px] ex-menu ex-animate-in',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(opt.value);
                setIsOpen(false);
              }}
              data-active={showCheck && opt.value === value}
              data-variant={opt.danger ? 'danger' : undefined}
              className="ex-menu-item justify-between"
            >
              <span>{opt.label}</span>
              {opt.value === value && showCheck && <Check size={14} strokeWidth={3} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const ShareModal: React.FC<Props> = ({ drawingId, drawingName, isOpen, onClose }) => {
  const { user } = useAuth();
  const currentUserId = user?.id || null;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<{
    permissions: api.DrawingPermissionRow[];
    linkShares: api.DrawingLinkShareRow[];
  } | null>(null);

  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<api.ShareResolvedUser[]>([]);
  const [userPermission, setUserPermission] = useState<"view" | "edit">("view");

  const [linkPermission, setLinkPermission] = useState<"view" | "edit">("view");
  const [expiryOption, setExpiryOption] = useState("1d");
  const [customExpiry, setCustomExpiry] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareableEditorUrl = `${origin}/shared/${drawingId}`;

  const activeLink = useMemo(() => {
    const now = Date.now();
    return (
      (sharing?.linkShares || []).find((s) => {
        if (s.revokedAt) return false;
        if (!s.expiresAt) return true;
        const ts = Date.parse(String(s.expiresAt));
        if (!Number.isFinite(ts)) return false;
        return ts > now;
      }) || null
    );
  }, [sharing]);

  const formatAutoDisableText = (expiresAt: string | null): string => {
    if (!expiresAt) return "External access does not auto-disable.";
    const ts = Date.parse(String(expiresAt));
    if (!Number.isFinite(ts)) return "External access will auto-disable.";
    return `External access auto-disables on ${new Date(ts).toLocaleString()}.`;
  };

  // Keep the permission dropdown aligned with the actual active link policy from the server.
  useEffect(() => {
    if (!isOpen) return;
    if (!activeLink) return;
    setLinkPermission(activeLink.permission);
  }, [activeLink, isOpen]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getDrawingSharing(drawingId);
      setSharing(data);
    } catch (err: unknown) {
      let message = "Failed to load sharing settings";
      if (api.isAxiosError(err)) {
        const serverMessage = typeof err.response?.data?.message === "string" ? err.response.data.message : null;
        if (serverMessage) message = serverMessage;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [drawingId]);

  useEffect(() => {
    if (!isOpen) return;
    setUserQuery("");
    setUserResults([]);
    setUserPermission("view");
    setLinkPermission("view");
    setExpiryOption("1d");
    setCustomExpiry("");
    setIsCopied(false);
    void refresh();
  }, [isOpen, refresh]);

  useEffect(() => {
    if (!isOpen) return;
    const q = userQuery.trim();
    if (q.length < 3) {
      setUserResults([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const users = await api.resolveShareUsers(drawingId, q);
        const filtered = currentUserId ? users.filter((u) => u.id !== currentUserId) : users;
        if (!cancelled) setUserResults(filtered);
      } catch {
        if (!cancelled) setUserResults([]);
      }
    };
    const t = window.setTimeout(run, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [currentUserId, drawingId, isOpen, userQuery]);

  const handleCopy = async (text: string) => {
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (permission denied / insecure context).
    }
  };

  const handleAddUser = async (uId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await api.upsertDrawingPermission(drawingId, { granteeUserId: uId, permission: userPermission });
      await refresh();
      setUserQuery("");
      setUserResults([]);
    } catch (err: unknown) {
      let message = "Failed to share with user";
      if (api.isAxiosError(err)) {
        const serverMessage = typeof err.response?.data?.message === "string" ? err.response.data.message : null;
        if (serverMessage) message = serverMessage;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeUser = async (permissionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await api.revokeDrawingPermission(drawingId, permissionId);
      await refresh();
    } catch {
      setError("Failed to revoke access");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateLink = async (newPermission?: "view" | "edit", newExpiry?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      if (activeLink) {
        await api.revokeLinkShare(drawingId, activeLink.id);
      }
      
      const perm = newPermission ?? linkPermission;
      setLinkPermission(perm);
      const expiresAt = newExpiry ?? calculateExpiresAt(expiryOption, customExpiry);
      
      await api.createLinkShare(drawingId, {
        permission: perm,
        expiresAt,
      });

      await refresh();
      void handleCopy(shareableEditorUrl);
    } catch (err: unknown) {
      let message = "Failed to update link";
      if (api.isAxiosError(err)) {
        const serverMessage = typeof err.response?.data?.message === "string" ? err.response.data.message : null;
        if (serverMessage) message = serverMessage;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeLink = async () => {
    if (!activeLink) return;
    setIsLoading(true);
    setError(null);
    try {
      await api.revokeLinkShare(drawingId, activeLink.id);
      await refresh();
    } catch {
      setError("Failed to revoke link");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentLinkUrl = activeLink ? shareableEditorUrl : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-[560px] ex-island flex flex-col ex-animate-in overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between border-b border-ex-divider">
          <h2 className="ex-title text-xl truncate pr-4" title={drawingName}>
            Share “{drawingName}”
          </h2>
          <button
            onClick={onClose}
            className="ex-btn-icon shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 px-6 pt-6 pb-6 space-y-6 overflow-visible">
          {error && (
            <div className="p-3 rounded-ex border border-ex-danger bg-ex-danger-soft text-sm font-medium text-ex-danger flex items-center gap-2.5">
              <AlertTriangle size={16} strokeWidth={2.5} />
              {error}
            </div>
          )}

          <section className="relative">
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ex-text-subtle group-focus-within:text-ex-primary transition-colors">
                <Search size={18} strokeWidth={2.5} />
              </div>
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Add people"
                className="ex-input pl-10"
              />
            </div>

            {userResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 ex-menu z-[200] ex-animate-in overflow-hidden">
                {userResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleAddUser(u.id)}
                    className="w-full text-left px-3 py-2.5 flex items-center gap-3 rounded-ex-sm hover:bg-ex-primary-soft transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-ex bg-ex-primary-soft flex items-center justify-center text-ex-primary font-bold text-base">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ex-text truncate">{u.name}</div>
                      <div className="text-xs text-ex-text-muted truncate">{u.email}</div>
                    </div>
                    <Plus size={16} className="text-ex-text-subtle group-hover:text-ex-primary transition-colors" strokeWidth={2.5} />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="ex-section-label px-1">People with access</h3>

            <div className="space-y-0.5">
              <div className="flex items-center gap-3 px-1 py-2.5 min-h-[56px]">
                <div className="w-10 h-10 rounded-ex bg-ex-surface-muted flex items-center justify-center text-ex-text-muted font-bold text-lg border border-ex-border shrink-0">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="text-sm font-semibold text-ex-text leading-tight">
                    {user?.name} <span className="text-ex-text-subtle font-normal ml-1">(you)</span>
                  </div>
                  <div className="text-xs text-ex-text-muted mt-0.5">{user?.email}</div>
                </div>
                <div className="ex-section-label pr-3 shrink-0">Owner</div>
              </div>

              {(sharing?.permissions || []).map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-1 py-2.5 min-h-[56px]">
                  <div className="w-10 h-10 rounded-ex bg-ex-primary-soft flex items-center justify-center text-ex-primary font-bold text-lg shrink-0">
                    {p.granteeUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="text-sm font-semibold text-ex-text leading-tight truncate">{p.granteeUser.name}</div>
                    <div className="text-xs text-ex-text-muted mt-0.5 truncate">{p.granteeUser.email}</div>
                  </div>
                  <div className="shrink-0 flex items-center h-full">
                    <CustomSelect
                      value={p.permission}
                      onChange={async (val) => {
                        if (val === 'remove') {
                          await handleRevokeUser(p.id);
                        } else {
                          await api.upsertDrawingPermission(drawingId, { granteeUserId: p.granteeUserId, permission: val as any });
                          void refresh();
                        }
                      }}
                      options={[
                        { label: 'Viewer', value: 'view' },
                        { label: 'Editor', value: 'edit' },
                        { label: 'Remove access', value: 'remove', danger: true },
                      ]}
                      align="right"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="pt-6 border-t border-ex-divider">
            <h3 className="ex-section-label px-1 mb-4">General access</h3>

            <div className="flex items-start gap-4 px-1">
              <div
                className={clsx(
                  'w-10 h-10 rounded-ex flex items-center justify-center shrink-0 border transition-colors mt-1',
                  activeLink
                    ? 'bg-ex-success-soft text-ex-success border-ex-success'
                    : 'bg-ex-surface-muted text-ex-text-subtle border-ex-border'
                )}
              >
                {activeLink ? <Globe size={20} strokeWidth={2} /> : <Lock size={20} strokeWidth={2} />}
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <CustomSelect
                    value={activeLink ? 'anyone' : 'restricted'}
                    onChange={(val) => {
                      if (val === 'anyone') void handleUpdateLink();
                      else void handleRevokeLink();
                    }}
                    options={[
                      { label: 'Restricted', value: 'restricted' },
                      { label: 'Anyone with the link', value: 'anyone' },
                    ]}
                    className="-ml-2"
                    showCheck={false}
                  />
                </div>

                <p className="text-sm text-ex-text-muted leading-snug px-1">
                  {activeLink
                    ? 'Anyone on the internet with the link can access.'
                    : 'Only people with access can open with the link.'}
                </p>

                {activeLink && (
                  <div className="pt-4 space-y-4 ex-animate-in">
                    <p className="text-xs text-ex-text-muted px-1">
                      {formatAutoDisableText(activeLink.expiresAt)}{' '}
                      When it disables, General access switches back to Restricted.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <CustomSelect
                        value={linkPermission}
                        onChange={(val) => handleUpdateLink(val as any)}
                        options={[
                          { label: 'Viewer', value: 'view' },
                          { label: 'Editor', value: 'edit' },
                        ]}
                        icon={<Shield size={14} strokeWidth={2.5} className="text-ex-text-subtle" />}
                        variant="bordered"
                      />

                      <CustomSelect
                        value={expiryOption}
                        onChange={(val) => {
                          setExpiryOption(val);
                          if (val !== 'custom') {
                            const nextExpiry = calculateExpiresAt(val);
                            void handleUpdateLink(undefined, nextExpiry);
                          }
                        }}
                        options={EXPIRY_OPTIONS}
                        icon={<Calendar size={14} strokeWidth={2.5} className="text-ex-text-subtle" />}
                        variant="bordered"
                      />
                    </div>

                    {expiryOption === 'custom' && (
                      <input
                        type="datetime-local"
                        value={customExpiry}
                        onChange={(e) => setCustomExpiry(e.target.value)}
                        onBlur={() => void handleUpdateLink()}
                        className="ex-input"
                      />
                    )}

                    {linkPermission === 'edit' && (
                      <div className="p-3 rounded-ex bg-ex-warning-soft border border-ex-warning">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle size={18} strokeWidth={2.5} className="text-ex-warning shrink-0 mt-0.5" />
                          <div className="text-xs text-ex-text leading-relaxed">
                            <span className="uppercase tracking-wider text-[10px] font-bold text-ex-warning">Security warning</span>
                            <br />
                            Edit access via link is sensitive. Anyone with the URL can edit until it expires or is disabled.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="px-6 py-4 flex items-center justify-between border-t border-ex-divider bg-ex-surface-muted">
          <button
            onClick={() => handleCopy(currentLinkUrl)}
            disabled={!activeLink}
            className={clsx('ex-btn', isCopied ? 'ex-btn-primary bg-ex-success border-ex-success' : 'ex-btn-ghost')}
          >
            {isCopied ? <Check size={16} strokeWidth={3} /> : <LinkIcon size={16} strokeWidth={2.5} />}
            {isCopied ? 'Copied' : 'Copy link'}
          </button>

          <button onClick={onClose} className="ex-btn ex-btn-primary">
            Done
          </button>
        </div>

        {isLoading && (
          <div className="absolute inset-0 bg-ex-surface/40 backdrop-blur-[1px] flex items-center justify-center z-[300] pointer-events-none rounded-ex-lg">
            <div className="ex-island p-4">
              <RefreshCw size={22} strokeWidth={2.5} className="animate-spin text-ex-primary" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
