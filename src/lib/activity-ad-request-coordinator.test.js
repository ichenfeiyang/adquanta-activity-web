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
