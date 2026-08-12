const STORAGE_PREFIX = "activity_watch_ad_settlement_v1";

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

export function watchAdSettlementStorageKey({ activityId = "", token = "" } = {}) {
  // Never place the bearer token itself in sessionStorage keys.
  return `${STORAGE_PREFIX}:${stableHash(activityId)}:${stableHash(token)}`;
}

export function clearWatchAdSettlement(scope = {}, { storage } = {}) {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.removeItem(watchAdSettlementStorageKey(scope));
  } catch (_) {}
}

/**
 * True when settlement is still a claimable entitlement.
 * Missing expires_at is allowed for same-page recovery when sessionStorage
 * failed after a successful Native callback.
 */
export function hasUsableWatchAdSettlement(settlement = {}, { now = Date.now() } = {}) {
  const sessionId = String(settlement?.session_id || "").trim();
  const adEventId = String(settlement?.ad_event_id || "").trim();
  if (!sessionId || !adEventId) return false;
  const expiresAt = expiryTime(settlement?.expires_at);
  if (expiresAt && expiresAt <= now) return false;
  return true;
}

export function saveWatchAdSettlement(scope = {}, settlement = {}, { storage, now = Date.now() } = {}) {
  const target = resolveStorage(storage);
  if (!target) return null;
  const sessionId = String(settlement.session_id || "").trim();
  const adEventId = String(settlement.ad_event_id || "").trim();
  const expiresAt = expiryTime(settlement.expires_at);
  if (!sessionId || !adEventId || !expiresAt || expiresAt <= now) {
    clearWatchAdSettlement(scope, { storage: target });
    return null;
  }
  const entry = {
    version: 1,
    session_id: sessionId,
    ad_event_id: adEventId,
    expires_at: new Date(expiresAt).toISOString(),
  };
  try {
    target.setItem(watchAdSettlementStorageKey(scope), JSON.stringify(entry));
    return entry;
  } catch (_) {
    return null;
  }
}

export function readWatchAdSettlement(scope = {}, { storage, now = Date.now() } = {}) {
  const target = resolveStorage(storage);
  if (!target) return null;
  try {
    const raw = target.getItem(watchAdSettlementStorageKey(scope));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    const expiresAt = expiryTime(entry?.expires_at);
    if (
      entry?.version !== 1 ||
      !String(entry?.session_id || "").trim() ||
      !String(entry?.ad_event_id || "").trim() ||
      !expiresAt ||
      expiresAt <= now
    ) {
      clearWatchAdSettlement(scope, { storage: target });
      return null;
    }
    return {
      version: 1,
      session_id: String(entry.session_id),
      ad_event_id: String(entry.ad_event_id),
      expires_at: new Date(expiresAt).toISOString(),
    };
  } catch (_) {
    clearWatchAdSettlement(scope, { storage: target });
    return null;
  }
}
