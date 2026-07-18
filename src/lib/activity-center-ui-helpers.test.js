import assert from "node:assert/strict";
import test from "node:test";
import {
  LUCKY_SPIN_PROMO_MAX_COIN,
  resolveCompletedVideoCount,
} from "./activity-center-ui-helpers.js";

test("lucky spin promotion advertises up to 200 coins", () => {
  assert.equal(LUCKY_SPIN_PROMO_MAX_COIN, 200);
});

test("lucky spin progress displays watched videos instead of remaining videos", () => {
  assert.equal(resolveCompletedVideoCount(2, 20, 18), 2);
  assert.equal(resolveCompletedVideoCount(2, 20, null), 2);
  assert.equal(resolveCompletedVideoCount(25, 20, null), 20);
});
