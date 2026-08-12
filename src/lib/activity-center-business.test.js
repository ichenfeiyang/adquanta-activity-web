import test from "node:test";
import assert from "node:assert/strict";

import { ActivityCenterBusiness } from "./activity-center-business.js";

import {
  clearCheckinChestSoftClosed,
  markCheckinChestSoftClosed,
  normalizeCheckinChestEligibleDays,
  normalizeCheckinChests,
  readSoftClosedCheckinChestIds,
} from "./checkin-chest.js";

function createMemoryStorage() {
  const values = new Map();
  return {
    clear: () => values.clear(),
    getItem: (key) => values.get(String(key)) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
  };
}

test("normalizeCheckinChests only exposes valid pending chests to the UI", () => {
  assert.deepEqual(normalizeCheckinChests([
    { id: "chest_7", continuous_day: "3", status: "pending", trigger: "base", guaranteed: true },
    { id: 8, continuous_day: 5, status: "claimed" },
    { id: 0, continuous_day: 7, status: "pending" },
  ]), [{ id: "chest_7", continuous_day: 3, status: "pending", trigger: "base", guaranteed: true }]);
});

test("normalizeCheckinChestEligibleDays keeps configured sign-in chest days", () => {
  assert.deepEqual(
    normalizeCheckinChestEligibleDays([7, "3", 5, 3, 0, 8, "invalid"]),
    [3, 5, 7],
  );
  assert.deepEqual(normalizeCheckinChestEligibleDays(undefined), []);
});

test("soft-closed chest ids persist for today and clear per id", () => {
  const originalSessionStorage = globalThis.sessionStorage;
  globalThis.sessionStorage = createMemoryStorage();
  const now = new Date("2026-07-20T12:00:00");
  try {
    sessionStorage.clear();
    markCheckinChestSoftClosed("chest_12", now);
    markCheckinChestSoftClosed("chest_12", now);
    assert.deepEqual([...readSoftClosedCheckinChestIds(now)], ["chest_12"]);
    clearCheckinChestSoftClosed("chest_12", now);
    assert.deepEqual([...readSoftClosedCheckinChestIds(now)], []);
  } finally {
    globalThis.sessionStorage = originalSessionStorage;
  }
});

test("check-in chest replay keeps one idempotency key until the queued claim succeeds", async () => {
  const originalFetch = globalThis.fetch;
  const originalSessionStorage = globalThis.sessionStorage;
  const storage = createMemoryStorage();
  const postBodies = [];
  let phase = "initial-response-lost";

  globalThis.sessionStorage = storage;
  globalThis.fetch = async (url, init = {}) => {
    if (init.method !== "POST") {
      return new Response(JSON.stringify({
        code: 200,
        data: { tasks: [{ task_id: "signin_replay", task_type: "signin" }] },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const body = JSON.parse(init.body);
    postBodies.push(body);
    if (phase === "initial-response-lost") {
      throw new Error("connection closed after response");
    }
    if (phase === "offline-replay") {
      throw new Error("Failed to fetch");
    }
    return new Response(JSON.stringify({
      code: 200,
      data: { payload: { success: true, coin: 5, total_coin: 15 } },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const business = new ActivityCenterBusiness();
    const options = { token: "checkin-chest-replay-token" };
    const submitResult = await business.submitCheckinChestAction(
      options,
      "claim",
      "chest_replay",
      "ad_event_replay",
    );
    assert.deepEqual(submitResult, { ok: false, queued: true });

    const queuedAfterSubmit = JSON.parse(storage.getItem("activity_checkin_chest_queue_v1"));
    assert.equal(queuedAfterSubmit.length, 1);
    assert.ok(queuedAfterSubmit[0].idempotent_key);
    assert.equal(queuedAfterSubmit[0].idempotent_key, postBodies[0].idempotent_key);

    phase = "offline-replay";
    await business.flushCheckinChestQueue(options);
    const queuedAfterFailure = JSON.parse(storage.getItem("activity_checkin_chest_queue_v1"));
    assert.equal(queuedAfterFailure.length, 1);
    assert.equal(queuedAfterFailure[0].idempotent_key, postBodies[0].idempotent_key);

    phase = "success";
    await business.flushCheckinChestQueue(options);

    assert.ok(postBodies.length >= 3);
    assert.ok(postBodies.every((body) => body.idempotent_key === postBodies[0].idempotent_key));
    assert.deepEqual(JSON.parse(storage.getItem("activity_checkin_chest_queue_v1")), []);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.sessionStorage = originalSessionStorage;
  }
});
