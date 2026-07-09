/**
 * In-memory + sessionStorage cache for activity pages (OSS static SPA).
 * Stale-while-revalidate: show cached data immediately, refresh in background.
 */

import {
  fingerprintActivityInfo,
  fingerprintChargeRecords,
  fingerprintCharges,
  fingerprintTremendousCatalog,
} from "./activity-cache-fingerprints.js";

const STORAGE_PREFIX = "activity_page_cache_v1";
const CHARGES_CACHE_KIND = "chargesByPhoneV2";
const TREMENDOUS_CATALOG_CACHE_KIND = "tremendousCatalogV1";

export const CACHE_TTL = {
  activityInfo: 30_000,
  chargeRecords: 60_000,
  chargesByPhone: 5 * 60_000,
  tremendousCatalog: 5 * 60_000,
};

const memoryCache = new Map();
const inflightRequests = new Map();

function hashToken(token) {
  const s = String(token || "anon");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return `t${(h >>> 0).toString(36)}`;
}

function scopedKey(kind, token, suffix = "") {
  const t = hashToken(token);
  return suffix ? `${kind}:${t}:${suffix}` : `${kind}:${t}`;
}

function storageKey(key) {
  return `${STORAGE_PREFIX}:${key}`;
}

function readEntry(key) {
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    memoryCache.set(key, entry);
    return entry;
  } catch (_) {
    return null;
  }
}

function writeEntry(key, data, ttlMs) {
  const entry = { data, fetchedAt: Date.now(), ttlMs };
  memoryCache.set(key, entry);
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch (_) {}
}

function removeEntry(key) {
  memoryCache.delete(key);
  try {
    sessionStorage.removeItem(storageKey(key));
  } catch (_) {}
}

function isFresh(entry) {
  if (!entry) return false;
  const ttl = Number(entry.ttlMs || 0);
  if (!ttl) return false;
  return Date.now() - entry.fetchedAt < ttl;
}

function getCachedData(key) {
  const entry = readEntry(key);
  return entry?.data ?? null;
}

function setCachedData(key, data, ttlMs) {
  writeEntry(key, data, ttlMs);
}

function runDeduped(key, runner) {
  if (inflightRequests.has(key)) {
    return inflightRequests.get(key);
  }
  const promise = Promise.resolve()
    .then(runner)
    .finally(() => {
      inflightRequests.delete(key);
    });
  inflightRequests.set(key, promise);
  return promise;
}

async function loadWithSWR({
  force,
  cacheKey,
  dedupeKey,
  fetcher,
  onData,
  isValidResponse,
  extractData,
  persist,
  fingerprint,
}) {
  if (!force) {
    const cached = getCachedData(cacheKey);
    if (cached != null) {
      onData?.(cached, { fromCache: true });
      runDeduped(dedupeKey, async () => {
        try {
          const res = await fetcher();
          if (isValidResponse(res)) {
            const data = extractData(res);
            const compare = fingerprint || ((value) => JSON.stringify(value));
            const unchanged = compare(data) === compare(cached);
            if (!unchanged) {
              persist(data);
              onData?.(data, { fromCache: false });
            }
          }
          return res;
        } catch (_) {
          return null;
        }
      }).catch(() => {});
      return { ok: true, data: cached, fromCache: true };
    }
  }

  try {
    const res = await runDeduped(dedupeKey, fetcher);
    if (isValidResponse(res)) {
      const data = extractData(res);
      persist(data);
      onData?.(data, { fromCache: false });
      return { ok: true, data, fromCache: false };
    }
    return { ok: false, error: new Error(res?.message || "API returned an error") };
  } catch (error) {
    return { ok: false, error };
  }
}

export function getActivityInfoCache(token) {
  return getCachedData(scopedKey("activityInfo", token));
}

export function isActivityInfoCacheFresh(token) {
  return isFresh(readEntry(scopedKey("activityInfo", token)));
}

export function setActivityInfoCache(token, data) {
  setCachedData(scopedKey("activityInfo", token), data, CACHE_TTL.activityInfo);
}

export function invalidateActivityInfoCache(token) {
  removeEntry(scopedKey("activityInfo", token));
}

export function patchActivityInfoWalletCoin(token, coin) {
  const key = scopedKey("activityInfo", token);
  const entry = readEntry(key);
  if (!entry?.data || typeof coin !== "number") return;
  const next = {
    ...entry.data,
    wallet_info: {
      ...(entry.data.wallet_info || {}),
      coin,
    },
  };
  writeEntry(key, next, CACHE_TTL.activityInfo);
}

export function getChargeRecordsCache(token) {
  return getCachedData(scopedKey("chargeRecords", token));
}

export function setChargeRecordsCache(token, data) {
  setCachedData(scopedKey("chargeRecords", token), data, CACHE_TTL.chargeRecords);
}

export function invalidateChargeRecordsCache(token) {
  removeEntry(scopedKey("chargeRecords", token));
}

export function getChargesCache(token, phoneNumber) {
  return getCachedData(scopedKey(CHARGES_CACHE_KIND, token, phoneNumber));
}

export function setChargesCache(token, phoneNumber, data) {
  setCachedData(scopedKey(CHARGES_CACHE_KIND, token, phoneNumber), data, CACHE_TTL.chargesByPhone);
}

export function getTremendousCatalogCache(token, countryCode, currencyCode) {
  return getCachedData(
    scopedKey(TREMENDOUS_CATALOG_CACHE_KIND, token, `${countryCode || ""}:${currencyCode || ""}`),
  );
}

export function setTremendousCatalogCache(token, countryCode, currencyCode, data) {
  setCachedData(
    scopedKey(TREMENDOUS_CATALOG_CACHE_KIND, token, `${countryCode || ""}:${currencyCode || ""}`),
    data,
    CACHE_TTL.tremendousCatalog,
  );
}

export async function loadActivityInfoWithSWR(token, { force = false, fetcher, onData }) {
  const cacheKey = scopedKey("activityInfo", token);
  return loadWithSWR({
    force,
    cacheKey,
    dedupeKey: scopedKey("activityInfo", token, "fetch"),
    fetcher,
    onData,
    isValidResponse: (res) => res?.code === 200 && res?.data,
    extractData: (res) => res.data,
    persist: (data) => setActivityInfoCache(token, data),
    fingerprint: fingerprintActivityInfo,
  });
}

export async function loadChargeRecordsWithSWR(token, { force = false, fetcher, onData }) {
  const cacheKey = scopedKey("chargeRecords", token);
  return loadWithSWR({
    force,
    cacheKey,
    dedupeKey: scopedKey("chargeRecords", token, "fetch"),
    fetcher,
    onData,
    isValidResponse: (res) => res?.code === 200 && res?.data != null,
    extractData: (res) => res.data,
    persist: (data) => setChargeRecordsCache(token, data),
    fingerprint: fingerprintChargeRecords,
  });
}

export async function loadChargesWithSWR(token, phoneNumber, { force = false, fetcher, onData }) {
  const cacheKey = scopedKey(CHARGES_CACHE_KIND, token, phoneNumber);
  return loadWithSWR({
    force,
    cacheKey,
    dedupeKey: scopedKey(CHARGES_CACHE_KIND, token, `${phoneNumber}:fetch`),
    fetcher,
    onData,
    isValidResponse: (res) => res?.code === 200 && res?.data != null,
    extractData: (res) => res.data,
    persist: (data) => setChargesCache(token, phoneNumber, data),
    fingerprint: fingerprintCharges,
  });
}

export async function loadTremendousCatalogWithSWR(
  token,
  countryCode,
  currencyCode,
  { force = false, fetcher, onData },
) {
  const suffix = `${countryCode || ""}:${currencyCode || ""}`;
  const cacheKey = scopedKey(TREMENDOUS_CATALOG_CACHE_KIND, token, suffix);
  return loadWithSWR({
    force,
    cacheKey,
    dedupeKey: scopedKey(TREMENDOUS_CATALOG_CACHE_KIND, token, `${suffix}:fetch`),
    fetcher,
    onData,
    isValidResponse: (res) => res?.code === 200 && res?.data != null,
    extractData: (res) => res.data,
    persist: (data) => setTremendousCatalogCache(token, countryCode, currencyCode, data),
    fingerprint: fingerprintTremendousCatalog,
  });
}
