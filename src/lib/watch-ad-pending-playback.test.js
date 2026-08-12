import assert from "node:assert/strict";
import test from "node:test";

import {
  clearWatchAdPendingPlayback,
  normalizeWatchAdPendingPlayback,
  readWatchAdPendingPlayback,
  saveWatchAdPendingPlayback,
  watchAdPendingPlaybackStorageKey,
} from "./watch-ad-pending-playback.js";
import { readWatchAdSettlement, watchAdSettlementStorageKey } from "./watch-ad-settlement.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
}

test("pending watch-ad playback is scoped without exposing the token or sharing the settlement key", () => {
  const scope = { activityId: "activity-a", token: "secret-bearer-token" };
  const playbackKey = watchAdPendingPlaybackStorageKey(scope);

  assert.equal(playbackKey.includes(scope.token), false);
  assert.notEqual(playbackKey, watchAdPendingPlaybackStorageKey({ ...scope, activityId: "activity-b" }));
  assert.notEqual(playbackKey, watchAdPendingPlaybackStorageKey({ ...scope, token: "another-token" }));
  assert.notEqual(playbackKey, watchAdSettlementStorageKey(scope));
});

test("pending playback requires all Native replay metadata and rejects expired sessions", () => {
  const now = Date.parse("2026-08-12T00:00:00Z");
  const complete = {
    session_id: "session-1",
    custom_data: "signed-custom-data",
    ad_event_id: "event-1",
    expires_at: "2026-08-12T00:15:00Z",
  };

  assert.deepEqual(normalizeWatchAdPendingPlayback(complete, { now }), {
    version: 1,
    ...complete,
    expires_at: "2026-08-12T00:15:00.000Z",
  });
  assert.equal(normalizeWatchAdPendingPlayback({ ...complete, custom_data: "" }, { now }), null);
  assert.equal(normalizeWatchAdPendingPlayback({ ...complete, expires_at: now }, { now }), null);
});

test("pending playback survives retryable Native failures until success clears it or it expires", () => {
  const storage = memoryStorage();
  const scope = { activityId: "activity-a", token: "token-a" };
  const now = Date.parse("2026-08-12T00:00:00Z");
  const playback = {
    session_id: "session-1",
    custom_data: "signed-custom-data",
    ad_event_id: "event-1",
    expires_at: "2026-08-12T00:15:00Z",
  };

  const saved = saveWatchAdPendingPlayback(scope, playback, { storage, now });
  assert.equal(saved.session_id, "session-1");
  // A prepared session is not proof that the ad completed and cannot unlock Spin Now.
  assert.equal(readWatchAdSettlement(scope, { storage, now }), null);
  // A Native failure does not mutate this playback record; the next click can replay it.
  assert.deepEqual(readWatchAdPendingPlayback(scope, { storage, now: now + 1 }), saved);

  clearWatchAdPendingPlayback(scope, { storage });
  assert.equal(readWatchAdPendingPlayback(scope, { storage, now: now + 2 }), null);

  saveWatchAdPendingPlayback(scope, playback, { storage, now });
  assert.equal(readWatchAdPendingPlayback(scope, { storage, now: now + 15 * 60_000 }), null);
  assert.equal(storage.values.size, 0);
});
