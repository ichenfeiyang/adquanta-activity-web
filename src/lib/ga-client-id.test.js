import assert from "node:assert/strict";
import test from "node:test";
import {
  __resetGaClientIdCacheForTests,
  buildGaClientIdHeader,
  isValidGaClientId,
  readGaClientId,
} from "./ga-client-id.js";

function withMockGtag(mockGtag, run) {
  const originalGtag = globalThis.gtag;
  globalThis.gtag = mockGtag;
  return Promise.resolve()
    .then(run)
    .finally(() => {
      globalThis.gtag = originalGtag;
    });
}

test("isValidGaClientId validates GA4 client id shape", () => {
  __resetGaClientIdCacheForTests();
  assert.equal(isValidGaClientId("5551234567.1760000000"), true);
  assert.equal(isValidGaClientId(" 5551234567.1760000000 "), true);
  assert.equal(isValidGaClientId("GA1.1.555.176"), false);
  assert.equal(isValidGaClientId("abc"), false);
  assert.equal(isValidGaClientId(""), false);
});

test("readGaClientId returns null when gtag is unavailable", async () => {
  __resetGaClientIdCacheForTests();
  await withMockGtag(undefined, async () => {
    const id = await readGaClientId({ measurementId: "G-TEST" });
    assert.equal(id, null);
  });
});

test("readGaClientId reads client id from gtag callback", async () => {
  __resetGaClientIdCacheForTests();
  await withMockGtag((command, measurementId, field, callback) => {
    assert.equal(command, "get");
    assert.equal(measurementId, "G-TEST");
    assert.equal(field, "client_id");
    callback("5551234567.1760000000");
  }, async () => {
    const id = await readGaClientId({ measurementId: "G-TEST" });
    assert.equal(id, "5551234567.1760000000");
  });
});

test("buildGaClientIdHeader prefers provided valid id", async () => {
  __resetGaClientIdCacheForTests();
  const header = await buildGaClientIdHeader({ gaClientId: "5551234567.1760000000" });
  assert.deepEqual(header, { "X-GA-Client-Id": "5551234567.1760000000" });
});

test("buildGaClientIdHeader returns empty object for invalid values", async () => {
  __resetGaClientIdCacheForTests();
  await withMockGtag((command, measurementId, field, callback) => {
    callback("invalid");
  }, async () => {
    const header = await buildGaClientIdHeader({ gaMeasurementId: "G-TEST", gaClientIdTimeoutMs: 10 });
    assert.deepEqual(header, {});
  });
});

test("readGaClientId caches valid client id to avoid repeated gtag reads", async () => {
  __resetGaClientIdCacheForTests();
  let calls = 0;
  await withMockGtag((command, measurementId, field, callback) => {
    calls += 1;
    callback("5551234567.1760000000");
  }, async () => {
    const first = await readGaClientId({ measurementId: "G-TEST" });
    const second = await readGaClientId({ measurementId: "G-TEST" });
    assert.equal(first, "5551234567.1760000000");
    assert.equal(second, "5551234567.1760000000");
    assert.equal(calls, 1);
  });
});
