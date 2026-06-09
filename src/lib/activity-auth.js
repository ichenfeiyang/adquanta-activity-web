export const TOKEN_STORAGE_KEY = "activity_entry_token_v1";
export const AUTH_CACHE_KEY = "activity_auth_cache_v1";

export function persistEntryToken(token) {
  if (!token) return;
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, String(token));
  } catch (_) {}
}

export function readEntryToken() {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY) || "";
  } catch (_) {
    return "";
  }
}

export function readSameOriginReferrerSearchParams() {
  try {
    const ref = document.referrer || "";
    if (!ref) return new URLSearchParams("");
    const refUrl = new URL(ref);
    if (refUrl.origin !== window.location.origin) return new URLSearchParams("");
    return refUrl.searchParams;
  } catch (_) {
    return new URLSearchParams("");
  }
}

function readAuthCacheToken() {
  try {
    const cachedRaw = sessionStorage.getItem(AUTH_CACHE_KEY) || "";
    const cached = cachedRaw ? JSON.parse(cachedRaw) : null;
    const expiresAt = Number(cached?.expiresAt || 0);
    const nowSec = Math.floor(Date.now() / 1000);
    const stillValid = !!cached?.token && (!expiresAt || nowSec < expiresAt - 30);
    if (stillValid) return String(cached.token || "");
  } catch (_) {}
  return "";
}

/**
 * Resolve bearer token: URL / route (first visit) -> sessionStorage -> auth cache.
 */
export function resolveEntryToken({ routeQuery = {} } = {}) {
  const qp = new URLSearchParams(window.location.search);
  const refQp = readSameOriginReferrerSearchParams();
  const rq = routeQuery || {};

  const tokenFromInput =
    qp.get("token") ||
    qp.get("access_token") ||
    refQp.get("token") ||
    refQp.get("access_token") ||
    String(rq.token || rq.access_token || "");

  if (tokenFromInput) {
    persistEntryToken(tokenFromInput);
    return String(tokenFromInput);
  }

  const cached = readAuthCacheToken();
  if (cached) {
    persistEntryToken(cached);
    return cached;
  }

  return readEntryToken();
}

/** Remove token from the address bar after it has been stored. */
export function stripTokenFromUrl() {
  try {
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of ["token", "access_token"]) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (!changed) return;
    const next = `${url.pathname}${url.search}${url.hash}`;
    history.replaceState(null, "", next);
  } catch (_) {}
}
