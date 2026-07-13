export const API_FETCH_MAX_ATTEMPTS = 3;
export const API_FETCH_RETRY_BASE_DELAY_MS = 400;

const NETWORK_ERROR_HINTS = [
  "load failed",
  "failed to fetch",
  "fetch failed",
  "network request failed",
  "network error",
  "the internet connection appears to be offline",
];

export function isRetryableNetworkError(error) {
  if (!error || typeof error !== "object") return false;
  if (error.name === "AbortError") return false;
  const msg = String(error.message || "").toLowerCase();
  return NETWORK_ERROR_HINTS.some((hint) => msg.includes(hint));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(url, init = {}, options = {}) {
  const maxAttempts = options.maxAttempts ?? API_FETCH_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? API_FETCH_RETRY_BASE_DELAY_MS;
  const { onRetry } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      if (!isRetryableNetworkError(error) || attempt >= maxAttempts) throw error;
      onRetry?.({ nextAttempt: attempt + 1, maxAttempts, error });
      await delay(baseDelayMs * attempt);
    }
  }
}
