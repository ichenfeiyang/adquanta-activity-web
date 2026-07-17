import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCheckinChests } from "./checkin-chest.js";

test("normalizeCheckinChests only exposes valid pending chests to the UI", () => {
  assert.deepEqual(normalizeCheckinChests([
    { id: "7", continuous_day: "3", status: "pending", trigger: "base", guaranteed: true },
    { id: 8, continuous_day: 5, status: "claimed" },
    { id: 0, continuous_day: 7, status: "pending" },
  ]), [{ id: 7, continuous_day: 3, status: "pending", trigger: "base", guaranteed: true }]);
});
