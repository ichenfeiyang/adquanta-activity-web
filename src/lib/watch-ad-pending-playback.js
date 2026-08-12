const STORAGE_PREFIX = "activity_watch_ad_pending_playback_v1";

function stableHash(value) {
  const text = String(value || "anonymous");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.sessionStorage || null;
  } catch (_) {
    return null;
  }
}

function expiryTime(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return value < 10_000_000_000 ? value * 1000 : value;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && String(value).trim() !== "") {
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function watchAdPendingPlaybackStorageKey({ activityId = "", token = "" } = {}) {
  // Scope recovery to one activity/user without persisting the bearer token.
  return `${STORAGE_PREFIX}:${stableHash(activityId)}:${stableHash(token)}`;
}

/**
 * Normalize a prepared-but-not-completed ad session. This state only permits
 * another Native playback attempt; it must never be treated as a settlement.
 */
export function normalizeWatchAdPendingPlayback(playback = {}, { now = Date.now() } = {}) {
  const sessionId = String(playback?.session_id || "").trim();
  const customData = String(playback?.custom_data || "").trim();
  const adEventId = String(playback?.ad_event_id || "").trim();
  const expiresAt = expiryTime(playback?.expires_at);
  if (!sessionId || !customData || !adEventId || !expiresAt || expiresAt <= now) return null;
  return {
    version: 1,
    session_id: sessionId,
    custom_data: customData,
    ad_event_id: adEventId,
    expires_at: new Date(expiresAt).toISOString(),
  };
}

export function clearWatchAdPendingPlayback(scope = {}, { storage } = {}) {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.removeItem(watchAdPendingPlaybackStorageKey(scope));
  } catch (_) {}
}

export function saveWatchAdPendingPlayback(scope = {}, playback = {}, { storage, now = Date.now() } = {}) {
  const target = resolveStorage(storage);
  const entry = normalizeWatchAdPendingPlayback(playback, { now });
  if (!entry) {
    clearWatchAdPendingPlayback(scope, { storage: target });
    return null;
  }
  if (!target) return null;
  try {
    target.setItem(watchAdPendingPlaybackStorageKey(scope), JSON.stringify(entry));
    return entry;
  } catch (_) {
    return null;
  }
}

export function readWatchAdPendingPlayback(scope = {}, { storage, now = Date.now() } = {}) {
  const target = resolveStorage(storage);
  if (!target) return null;
  try {
    const raw = target.getItem(watchAdPendingPlaybackStorageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const entry = parsed?.version === 1
      ? normalizeWatchAdPendingPlayback(parsed, { now })
      : null;
    if (!entry) clearWatchAdPendingPlayback(scope, { storage: target });
    return entry;
  } catch (_) {
    clearWatchAdPendingPlayback(scope, { storage: target });
    return null;
  }
}
