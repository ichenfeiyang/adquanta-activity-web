import test from "node:test";
import assert from "node:assert/strict";

import { ActivityAdRequestCoordinator } from "./activity-ad-request-coordinator.js";

test("serializes requests and atomically consumes one matching callback", () => {
  const coordinator = new ActivityAdRequestCoordinator();
  const request = coordinator.begin("reward_ad", "task_new_user_bonus");

  assert.deepEqual(request, { eventType: "reward_ad", taskId: "task_new_user_bonus" });
  assert.equal(coordinator.begin("interstitial_ad", "task_checkin"), null);
  assert.equal(coordinator.getTaskId("reward_ad"), "task_new_user_bonus");
  assert.equal(coordinator.take("interstitial_ad"), null);
  assert.deepEqual(coordinator.take("reward_ad"), request);
  assert.equal(coordinator.take("reward_ad"), null);
});

test("cancels only the active request instance", () => {
  const coordinator = new ActivityAdRequestCoordinator();
  const request = coordinator.begin("reward_ad", "task_watch_ad");
  coordinator.cancel({ eventType: "reward_ad", taskId: "task_watch_ad" });
  assert.equal(coordinator.getTaskId("reward_ad"), "task_watch_ad");
  coordinator.cancel(request);
  assert.equal(coordinator.getTaskId("reward_ad"), "");
});

test("preserves request metadata until the terminal SDK callback", () => {
  const coordinator = new ActivityAdRequestCoordinator();
  const request = coordinator.begin("reward_ad", "task_coin_rain", {
    coinRainAdEventId: "coin-rain-test-event",
  });

  assert.equal(request.coinRainAdEventId, "coin-rain-test-event");
  assert.deepEqual(coordinator.take("reward_ad"), request);
});

test("normalizes Native callback event aliases before consuming the request", () => {
  const coordinator = new ActivityAdRequestCoordinator();
  const request = coordinator.begin("reward_ad", "task_watch_ad");

  assert.deepEqual(coordinator.take("reward"), request);
});

test("automatically releases a request when its terminal callback is missing", async () => {
  let timedOut = null;
  const coordinator = new ActivityAdRequestCoordinator({
    timeoutMs: 5,
    onTimeout: (request) => { timedOut = request; },
  });
  const request = coordinator.begin("reward_ad", "task_watch_ad");

  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.deepEqual(timedOut, request);
  assert.equal(coordinator.getTaskId("reward_ad"), "");
  assert.equal(coordinator.take("reward_ad"), null);
});

test("dispose clears an outstanding callback timeout", async () => {
  let timedOut = false;
  const coordinator = new ActivityAdRequestCoordinator({
    timeoutMs: 5,
    onTimeout: () => { timedOut = true; },
  });
  coordinator.begin("reward_ad", "task_watch_ad");
  coordinator.dispose();

  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(timedOut, false);
});
