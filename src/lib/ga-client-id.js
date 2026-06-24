const GA_CLIENT_ID_HEADER = "X-GA-Client-Id";
const GA_CLIENT_ID_PATTERN = /^\d+\.\d+$/;
const DEFAULT_TIMEOUT_MS = 120;
const MISSING_CLIENT_ID_RETRY_MS = 10000;

let cachedClientId = null;
let lastMissingClientIdAt = 0;

function getMeasurementId() {
  return String(import.meta.env.VITE_GA_MEASUREMENT_ID || "").trim();
}

export function isValidGaClientId(value) {
  return GA_CLIENT_ID_PATTERN.test(String(value || "").trim());
}

function getGtag() {
  if (typeof globalThis === "undefined") return null;
  return typeof globalThis.gtag === "function" ? globalThis.gtag : null;
}

export function readGaClientId({ measurementId = "", timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (isValidGaClientId(cachedClientId)) {
    return Promise.resolve(cachedClientId);
  }

  const now = Date.now();
  if (now - lastMissingClientIdAt < MISSING_CLIENT_ID_RETRY_MS) {
    return Promise.resolve(null);
  }

  const gtag = getGtag();
  const targetMeasurementId = String(measurementId || getMeasurementId()).trim();
  if (!gtag || !targetMeasurementId) {
    lastMissingClientIdAt = now;
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;
    function finish(value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (isValidGaClientId(value)) {
        cachedClientId = value;
      } else {
        lastMissingClientIdAt = Date.now();
      }
      resolve(value);
    }

    const timer = setTimeout(() => {
      finish(null);
    }, Math.max(0, Number(timeoutMs) || 0));

    try {
      gtag("get", targetMeasurementId, "client_id", (id) => {
        const value = String(id || "").trim();
        finish(isValidGaClientId(value) ? value : null);
      });
    } catch (_) {
      finish(null);
    }
  });
}

export async function buildGaClientIdHeader(options = {}) {
  const provided = String(options.gaClientId || "").trim();
  if (isValidGaClientId(provided)) {
    return { [GA_CLIENT_ID_HEADER]: provided };
  }

  const clientId = await readGaClientId({
    measurementId: options.gaMeasurementId,
    timeoutMs: options.gaClientIdTimeoutMs,
  });
  if (!clientId) return {};
  return { [GA_CLIENT_ID_HEADER]: clientId };
}

export function __resetGaClientIdCacheForTests() {
  cachedClientId = null;
  lastMissingClientIdAt = 0;
}
