import assert from "node:assert/strict";
import test from "node:test";
import {
  findCurrentDenomination,
  isInsufficientCoinMessage,
  shouldApplyLookupResult,
  trimInputToMax,
  willInputExceedLimit,
} from "./redeem-request-guard.js";

test("shouldApplyLookupResult drops stale phone lookups", () => {
  assert.equal(
    shouldApplyLookupResult({
      requestKey: "IN:9876543210",
      desiredKey: "IN:9999999999",
      currentKey: "IN:9999999999",
    }),
    false,
  );
  assert.equal(
    shouldApplyLookupResult({
      requestKey: "IN:9999999999",
      desiredKey: "IN:9999999999",
      currentKey: "IN:9999999999",
    }),
    true,
  );
});

test("shouldApplyLookupResult rejects stale gift catalog country responses", () => {
  assert.equal(
    shouldApplyLookupResult({
      requestKey: "IN:INR",
      desiredKey: "PK:PKR",
      currentKey: "PK:PKR",
    }),
    false,
  );
  assert.equal(
    shouldApplyLookupResult({
      requestKey: "PK:PKR",
      desiredKey: "PK:PKR",
      currentKey: "PK:PKR",
    }),
    true,
  );
});

test("findCurrentDenomination replaces a cached gift price with the refreshed option", () => {
  const refreshed = findCurrentDenomination(
    [
      { denomination: 100, spend_coin: 80 },
      { denomination: 200, spend_coin: 150 },
    ],
    { denomination: 100, spend_coin: 50 },
  );
  assert.deepEqual(refreshed, { denomination: 100, spend_coin: 80 });
  assert.equal(findCurrentDenomination([{ denomination: 200, spend_coin: 150 }], { denomination: 100 }), null);
});

test("isInsufficientCoinMessage recognizes backend balance errors", () => {
  assert.equal(isInsufficientCoinMessage("金币余额不足"), true);
  assert.equal(isInsufficientCoinMessage("Insufficient coin balance"), true);
  assert.equal(isInsufficientCoinMessage("礼品配置不可用"), false);
});

test("trimInputToMax truncates oversized values", () => {
  const input = { value: "abcdefghij" };
  assert.equal(trimInputToMax(input, 5), true);
  assert.equal(input.value, "abcde");
  assert.equal(trimInputToMax(input, 5), false);
});

test("willInputExceedLimit accounts for selection replacement", () => {
  const input = { value: "abcd", selectionStart: 2, selectionEnd: 4 };
  assert.equal(willInputExceedLimit(input, { data: "XYZ" }, 5), false);
  assert.equal(willInputExceedLimit(input, { data: "WXYZ" }, 5), true);
});
