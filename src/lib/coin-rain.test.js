import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCoinRain } from "./coin-rain.js";

test("normalizeCoinRain keeps only server-controlled display state", () => {
  const normalized = normalizeCoinRain({
    enabled: true,
    state: "boost_available",
    terminal_reason: "",
    duration_seconds: 30,
    display_max_coin: 500,
    base_max_coin: 250,
    session_id: "session-1",
    base_coin: 80,
    boost_coin: 0,
    boost_available: true,
  });
  assert.deepEqual(normalized, {
    enabled: true,
    state: "boost_available",
    terminal_reason: "",
    duration_seconds: 30,
    display_max_coin: 500,
    base_max_coin: 250,
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
  assert.equal(normalizeCoinRain({ enabled: true, display_max_coin: 500 }), null);
  assert.equal(normalizeCoinRain({ enabled: true, display_max_coin: 0, base_max_coin: 250 }), null);
});

test("normalizeCoinRain preserves abandoned as a consumed daily attempt", () => {
  const normalized = normalizeCoinRain({
    enabled: true,
    state: "completed",
    terminal_reason: "abandoned",
    duration_seconds: 30,
    display_max_coin: 400,
    base_max_coin: 200,
  });
  assert.equal(normalized.state, "completed");
  assert.equal(normalized.terminal_reason, "abandoned");
});
