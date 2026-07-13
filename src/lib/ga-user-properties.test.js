import assert from "node:assert/strict";
import test from "node:test";
import {
  __resetGoldCoinsUserPropertyForTests,
  syncGoldCoinsFromActivityInfo,
  syncGoldCoinsUserProperty,
} from "./ga-user-properties.js";

function withMockGtag(mockGtag, run) {
  const originalGtag = globalThis.gtag;
  globalThis.gtag = mockGtag;
  return Promise.resolve()
    .then(run)
    .finally(() => {
      globalThis.gtag = originalGtag;
      __resetGoldCoinsUserPropertyForTests();
    });
}

test("syncGoldCoinsUserProperty sets gtag user_properties", async () => {
  const calls = [];
  await withMockGtag(
    function () {
      calls.push(Array.from(arguments));
    },
    async () => {
      syncGoldCoinsUserProperty(120);
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0], ["set", "user_properties", { gold_coins: 120 }]);
    },
  );
});

test("syncGoldCoinsUserProperty skips duplicate coin values", async () => {
  let calls = 0;
  await withMockGtag(
    function () {
      calls += 1;
    },
    async () => {
      syncGoldCoinsUserProperty(50);
      syncGoldCoinsUserProperty(50);
      assert.equal(calls, 1);
    },
  );
});

test("syncGoldCoinsFromActivityInfo reads wallet coin", async () => {
  const calls = [];
  await withMockGtag(
    function () {
      calls.push(Array.from(arguments));
    },
    async () => {
      syncGoldCoinsFromActivityInfo({ wallet_info: { coin: 321 } });
      assert.deepEqual(calls[0], ["set", "user_properties", { gold_coins: 321 }]);
    },
  );
});
