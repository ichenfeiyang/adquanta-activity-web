import test from "node:test";
import assert from "node:assert/strict";

import {
  chunkRecentRedemptions,
  normalizeRecentRedemptions,
  nextRecentRedemptionBatchIndex,
} from "./recent-redemptions.js";

test("normalizeRecentRedemptions keeps only safe display fields", () => {
  const items = normalizeRecentRedemptions([
    {
      masked_user_id: "User ***1234",
      reward_type: "data",
      reward_name: "6 GB Data",
      reward_icon_url: "https://cdn.example.com/data.png",
      redeemed_date: "2026-07-20",
      phone_number: "918800000000",
    },
    { masked_user_id: "", reward_name: "invalid" },
  ]);

  assert.deepEqual(items, [
    {
      maskedUserId: "User ***1234",
      rewardType: "data",
      rewardName: "6 GB Data",
      rewardIconUrl: "https://cdn.example.com/data.png",
      redeemedDate: "2026-07-20",
    },
  ]);
});

test("chunkRecentRedemptions creates three-row batches", () => {
  const items = Array.from({ length: 7 }, (_, index) => ({ maskedUserId: `User ${index}` }));
  assert.deepEqual(chunkRecentRedemptions(items, 3).map((batch) => batch.length), [3, 3, 1]);
});

test("nextRecentRedemptionBatchIndex loops through available batches", () => {
  assert.equal(nextRecentRedemptionBatchIndex(0, 4), 1);
  assert.equal(nextRecentRedemptionBatchIndex(3, 4), 0);
  assert.equal(nextRecentRedemptionBatchIndex(0, 1), 0);
});
