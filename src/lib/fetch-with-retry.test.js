import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchWithRetry,
  isRetryableNetworkError,
} from "./fetch-with-retry.js";

const retryOptions = { maxAttempts: 3, baseDelayMs: 0 };
const testUrl = "https://example.test/api";

async function withMockFetch(mockFetch, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("isRetryableNetworkError", () => {
  assert.equal(isRetryableNetworkError(new TypeError("Load failed")), true);
  assert.equal(isRetryableNetworkError(new Error("Failed to fetch")), true);
  assert.equal(isRetryableNetworkError(new TypeError("Cannot read properties of undefined")), false);

  const abort = new Error("The user aborted a request.");
  abort.name = "AbortError";
  assert.equal(isRetryableNetworkError(abort), false);
  assert.equal(isRetryableNetworkError(new Error("HTTP 401")), false);
});

test("fetchWithRetry retries transport failures and rethrows the last error", async () => {
  let calls = 0;
  await withMockFetch(async () => {
    calls += 1;
    throw new TypeError("Load failed");
  }, async () => {
    await assert.rejects(
      () => fetchWithRetry(testUrl, {}, retryOptions),
      (error) => error instanceof TypeError && error.message === "Load failed",
    );
    assert.equal(calls, 3);
  });
});

test("fetchWithRetry succeeds when a later attempt works", async () => {
  let calls = 0;
  await withMockFetch(async () => {
    calls += 1;
    if (calls < 2) throw new TypeError("Load failed");
    return new Response("ok", { status: 200 });
  }, async () => {
    const response = await fetchWithRetry(testUrl, {}, retryOptions);
    assert.equal(calls, 2);
    assert.equal(response.status, 200);
  });
});

test("fetchWithRetry does not retry abort errors", async () => {
  let calls = 0;
  const abort = new Error("The user aborted a request.");
  abort.name = "AbortError";

  await withMockFetch(async () => {
    calls += 1;
    throw abort;
  }, async () => {
    await assert.rejects(
      () => fetchWithRetry(testUrl, {}, retryOptions),
      (error) => error === abort,
    );
    assert.equal(calls, 1);
  });
});

test("fetchWithRetry does not retry HTTP error responses", async () => {
  let calls = 0;
  await withMockFetch(async () => {
    calls += 1;
    return new Response("service unavailable", { status: 503 });
  }, async () => {
    const response = await fetchWithRetry(testUrl, {}, retryOptions);
    assert.equal(calls, 1);
    assert.equal(response.status, 503);
  });
});
