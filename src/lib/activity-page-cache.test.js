import assert from "node:assert/strict";
import test from "node:test";

import { chargesCacheSuffix } from "./activity-page-cache.js";

test("charges cache suffix includes country and phone so US/CA do not collide", () => {
  assert.equal(chargesCacheSuffix("US", "14165551234"), "US:14165551234");
  assert.equal(chargesCacheSuffix("CA", "14165551234"), "CA:14165551234");
  assert.notEqual(chargesCacheSuffix("US", "14165551234"), chargesCacheSuffix("CA", "14165551234"));
  assert.equal(chargesCacheSuffix(" ca ", "14165551234"), "CA:14165551234");
});
