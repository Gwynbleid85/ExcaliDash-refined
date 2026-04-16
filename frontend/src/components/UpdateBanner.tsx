import React, { useEffect, useState } from "react";
import { BellOff, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import * as api from "../api";

const CHANNEL_KEY = "excalidash-update-channel";
const DISMISSED_VERSION_KEY = "excalidash-update-ignored-version";
const LAST_CHECK_KEY = "excalidash-update-last-check";
const UPDATE_INFO_KEY = "excalidash-update-info";
const CLOSED_VERSION_KEY = "excalidash-update-banner-closed-version";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const safeGetItem = (key: string): string | null => {
  try {
    if (typeof window === "undefined") return null;
    const storage = window.localStorage;
    if (!storage || typeof storage.getItem !== "function") return null;
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetItem = (key: string, value: string): void => {
  try {
    if (typeof window === "undefined") return;
    const storage = window.localStorage;
    if (!storage || typeof storage.setItem !== "function") return;
    storage.setItem(key, value);
  } catch {
  }
};

const safeGetSessionItem = (key: string): string | null => {
  try {
    if (typeof window === "undefined") return null;
    const storage = window.sessionStorage;
    if (!storage || typeof storage.getItem !== "function") return null;
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetSessionItem = (key: string, value: string): void => {
  try {
    if (typeof window === "undefined") return;
    const storage = window.sessionStorage;
    if (!storage || typeof storage.setItem !== "function") return;
    storage.setItem(key, value);
  } catch {
  }
};

const readChannel = (): api.UpdateChannel => {
  const raw = safeGetItem(CHANNEL_KEY);
  return raw === "prerelease" ? "prerelease" : "stable";
};

const writeChannel = (channel: api.UpdateChannel) => {
  safeSetItem(CHANNEL_KEY, channel);
};

const lastCheckStorageKey = (channel: api.UpdateChannel) => `${LAST_CHECK_KEY}:${channel}`;
const updateInfoStorageKey = (channel: api.UpdateChannel) => `${UPDATE_INFO_KEY}:${channel}`;
const closedVersionStorageKey = (channel: api.UpdateChannel) => `${CLOSED_VERSION_KEY}:${channel}`;

const shouldCheckNow = (channel: api.UpdateChannel): boolean => {
  const raw = safeGetItem(lastCheckStorageKey(channel));
  const last = raw ? Number(raw) : NaN;
  if (!Number.isFinite(last)) return true;
  return Date.now() - last >= CHECK_INTERVAL_MS;
};

const markCheckedNow = (channel: api.UpdateChannel) => {
  safeSetItem(lastCheckStorageKey(channel), String(Date.now()));
};

const readCachedInfo = (channel: api.UpdateChannel): api.UpdateInfo | null => {
  const raw = safeGetItem(updateInfoStorageKey(channel));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as api.UpdateInfo;
  } catch {
    return null;
  }
};

const writeCachedInfo = (channel: api.UpdateChannel, info: api.UpdateInfo) => {
  safeSetItem(updateInfoStorageKey(channel), JSON.stringify(info));
};

export const UpdateBanner: React.FC = () => {
  const [channel, setChannel] = useState<api.UpdateChannel>(() => readChannel());
  const [info, setInfo] = useState<api.UpdateInfo | null>(() => readCachedInfo(readChannel()));
  const [loading, setLoading] = useState(false);
  const [ignoredVersion, setIgnoredVersion] = useState<string | null>(() =>
    safeGetItem(DISMISSED_VERSION_KEY)
  );
  const [closedVersion, setClosedVersion] = useState<string | null>(() =>
    safeGetSessionItem(closedVersionStorageKey(readChannel()))
  );

  const load = async (force: boolean) => {
    if (!force && !shouldCheckNow(channel)) return;
    setLoading(true);
    try {
      const data = await api.getUpdateInfo(channel);
      setInfo(data);
      writeCachedInfo(channel, data);
      markCheckedNow(channel);
    } catch {
      markCheckedNow(channel);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setInfo(readCachedInfo(channel));
    setClosedVersion(safeGetSessionItem(closedVersionStorageKey(channel)));
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  useEffect(() => {
    setIgnoredVersion(safeGetItem(DISMISSED_VERSION_KEY));
  }, [info?.latestVersion]);

  useEffect(() => {
    setClosedVersion(safeGetSessionItem(closedVersionStorageKey(channel)));
  }, [channel, info?.latestVersion]);

  const updateAvailable =
    info?.outboundEnabled &&
    info?.isUpdateAvailable === true &&
    Boolean(info.latestVersion) &&
    info.latestVersion !== ignoredVersion &&
    info.latestVersion !== closedVersion;

  if (!updateAvailable) return null;

  return (
    <div className="sticky top-0 z-[44] -mt-2 mb-6 rounded-ex border border-ex-border bg-ex-success-soft px-3 py-2 transition-all duration-200">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ex-success">Update available</span>
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-sm font-semibold text-ex-text truncate">
              v{info?.latestVersion}
            </span>
            <span className="hidden sm:inline text-xs text-ex-text-muted">
              ({channel})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <select
            value={channel}
            onChange={(e) => {
              const next = (e.target.value === "prerelease" ? "prerelease" : "stable") as api.UpdateChannel;
              writeChannel(next);
              setChannel(next);
            }}
            className="h-8 px-2 rounded-ex-sm border border-ex-border bg-ex-surface text-xs font-semibold text-ex-text outline-none hover:border-ex-border-strong transition-colors"
            title="Update channel"
            aria-label="Update channel"
          >
            <option value="stable">stable</option>
            <option value="prerelease">prerelease</option>
          </select>

          {info?.latestUrl ? (
            <a
              href={info.latestUrl}
              target="_blank"
              rel="noreferrer"
              className="h-8 inline-flex items-center gap-1.5 px-3 rounded-ex-sm text-[11px] font-bold uppercase tracking-wider bg-ex-success text-white hover:brightness-95 transition-all"
            >
              <ExternalLink size={14} strokeWidth={2.5} />
              <span className="hidden sm:inline">Release</span>
            </a>
          ) : null}

          <button
            type="button"
            onClick={() => {
              const latest = info?.latestVersion;
              if (!latest) return;
              safeSetSessionItem(closedVersionStorageKey(channel), latest);
              setClosedVersion(latest);
            }}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-ex-sm bg-ex-surface border border-ex-border text-[11px] font-bold uppercase tracking-wider text-ex-text hover:bg-ex-surface-hover transition-colors"
            title="Close (will reappear later)"
          >
            <XCircle size={14} strokeWidth={2.5} />
            <span className="hidden sm:inline">Close</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const latest = info?.latestVersion;
              if (!latest) return;
              safeSetItem(DISMISSED_VERSION_KEY, latest);
              setIgnoredVersion(latest);
            }}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-ex-sm bg-ex-success-soft border border-ex-border text-[11px] font-bold uppercase tracking-wider text-ex-text hover:bg-ex-surface-hover transition-colors"
            title="Ignore this version"
          >
            <BellOff size={14} strokeWidth={2.5} />
            <span className="hidden sm:inline">Ignore</span>
          </button>

          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading}
            className="h-8 w-8 inline-flex items-center justify-center rounded-ex-sm bg-ex-surface border border-ex-border text-ex-text hover:bg-ex-surface-hover transition-colors disabled:opacity-50"
            title="Re-check now"
            aria-label="Re-check now"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
};
