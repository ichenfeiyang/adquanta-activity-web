import test from "node:test";
import assert from "node:assert/strict";

import {
  clearCheckinChestSoftClosed,
  markCheckinChestSoftClosed,
  normalizeCheckinChestEligibleDays,
  normalizeCheckinChests,
  readSoftClosedCheckinChestIds,
} from "./checkin-chest.js";

test("normalizeCheckinChests only exposes valid pending chests to the UI", () => {
  assert.deepEqual(normalizeCheckinChests([
    { id: "7", continuous_day: "3", status: "pending", trigger: "base", guaranteed: true },
    { id: 8, continuous_day: 5, status: "claimed" },
    { id: 0, continuous_day: 7, status: "pending" },
  ]), [{ id: 7, continuous_day: 3, status: "pending", trigger: "base", guaranteed: true }]);
});

test("normalizeCheckinChestEligibleDays keeps configured sign-in chest days", () => {
  assert.deepEqual(
    normalizeCheckinChestEligibleDays([7, "3", 5, 3, 0, 8, "invalid"]),
    [3, 5, 7],
  );
  assert.deepEqual(normalizeCheckinChestEligibleDays(undefined), []);
});

test("soft-closed chest ids persist for today and clear per id", () => {
  const now = new Date("2026-07-20T12:00:00");
  sessionStorage.clear();
  markCheckinChestSoftClosed(12, now);
  markCheckinChestSoftClosed(12, now);
  assert.deepEqual([...readSoftClosedCheckinChestIds(now)], [12]);
  clearCheckinChestSoftClosed(12, now);
  assert.deepEqual([...readSoftClosedCheckinChestIds(now)], []);
});
