import assert from "node:assert/strict";
import test from "node:test";

import {
  clearWatchAdSettlement,
  hasUsableWatchAdSettlement,
  readWatchAdSettlement,
  saveWatchAdSettlement,
  watchAdSettlementStorageKey,
} from "./watch-ad-settlement.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
}

test("watch-ad settlement is isolated without exposing the bearer token", () => {
  const token = "secret-bearer-token";
  const first = watchAdSettlementStorageKey({ activityId: "activity-a", token });
  const second = watchAdSettlementStorageKey({ activityId: "activity-b", token });
  const anotherUser = watchAdSettlementStorageKey({ activityId: "activity-a", token: "other-token" });

  assert.equal(first.includes(token), false);
  assert.notEqual(first, second);
  assert.notEqual(first, anotherUser);
});

test("watch-ad settlement saves and restores only an unexpired complete session", () => {
  const storage = memoryStorage();
  const scope = { activityId: "activity-a", token: "token-a" };
  const now = Date.parse("2026-08-12T00:00:00Z");
  const saved = saveWatchAdSettlement(
    scope,
    {
      session_id: "session-1",
      ad_event_id: "event-1",
      expires_at: "2026-08-12T00:15:00Z",
      settlement_mode: "ssv",
      baseline_join_count_today: 2,
      baseline_join_count_total: 12,
      baseline_last_join_id: "join-before",
    },
    { storage, now },
  );

  assert.equal(saved.session_id, "session-1");
  assert.deepEqual(readWatchAdSettlement(scope, { storage, now: now + 1 }), saved);
  assert.equal(readWatchAdSettlement(scope, { storage, now: now + 15 * 60_000 }), null);
  assert.equal(storage.values.size, 0);
});

test("watch-ad settlement rejects incomplete data and can be cleared", () => {
  const storage = memoryStorage();
  const scope = { activityId: "activity-a", token: "token-a" };
  const now = Date.now();

  assert.equal(
    saveWatchAdSettlement(scope, { session_id: "session-1", expires_at: now + 10_000 }, { storage, now }),
    null,
  );
  assert.equal(
    saveWatchAdSettlement(
      scope,
      { session_id: "session-1", ad_event_id: "event-1", expires_at: now + 10_000, settlement_mode: "ssv" },
      { storage, now },
    ),
    null,
  );
  saveWatchAdSettlement(
    scope,
    { session_id: "session-1", ad_event_id: "event-1", expires_at: now + 10_000, settlement_mode: "client_complete" },
    { storage, now },
  );
  clearWatchAdSettlement(scope, { storage });
  assert.equal(readWatchAdSettlement(scope, { storage, now }), null);
});

test("hasUsableWatchAdSettlement keeps same-page entitlements and rejects expired ones", () => {
  const now = Date.parse("2026-08-12T00:00:00Z");
  assert.equal(
    hasUsableWatchAdSettlement({ session_id: "s1", ad_event_id: "e1", settlement_mode: "client_complete" }, { now }),
    true,
  );
  assert.equal(
    hasUsableWatchAdSettlement(
      {
        session_id: "s1", ad_event_id: "e1", expires_at: "2026-08-12T00:10:00Z",
        settlement_mode: "ssv", baseline_join_count_today: 2, baseline_join_count_total: 12, baseline_last_join_id: "join-before",
      },
      { now },
    ),
    true,
  );
  assert.equal(
    hasUsableWatchAdSettlement(
      {
        session_id: "s1", ad_event_id: "e1", expires_at: "2026-08-11T23:59:00Z",
        settlement_mode: "ssv", baseline_join_count_today: 2, baseline_join_count_total: 12, baseline_last_join_id: "join-before",
      },
      { now },
    ),
    false,
  );
  assert.equal(hasUsableWatchAdSettlement({ session_id: "s1" }, { now }), false);
  assert.equal(
    hasUsableWatchAdSettlement({ session_id: "s1", ad_event_id: "e1", settlement_mode: "ssv" }, { now }),
    false,
  );
});
