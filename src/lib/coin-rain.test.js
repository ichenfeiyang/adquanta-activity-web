import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCoinRain } from "./coin-rain.js";

test("normalizeCoinRain keeps only server-controlled display state", () => {
  const normalized = normalizeCoinRain({
    enabled: true,
    state: "boost_available",
    duration_seconds: 30,
    display_max_coin: 400,
    session_id: "session-1",
    base_coin: 80,
    boost_coin: 0,
    boost_available: true,
    reward_cap: 999,
  });
  assert.deepEqual(normalized, {
    enabled: true,
    state: "boost_available",
    duration_seconds: 30,
    display_max_coin: 400,
    session_id: "session-1",
    deadline_at: null,
    base_coin: 80,
    boost_coin: 0,
    boost_available: true,
  });
});

test("normalizeCoinRain hides disabled or missing configuration", () => {
  assert.equal(normalizeCoinRain(null), null);
  assert.equal(normalizeCoinRain({ enabled: false }), null);
});
