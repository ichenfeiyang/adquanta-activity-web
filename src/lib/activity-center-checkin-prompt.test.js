import assert from "node:assert/strict";
import test from "node:test";

import { ActivityCenterBusiness } from "./activity-center-business.js";

const activityInfo = {
  user_info: { user_id: "user-1" },
  wallet_info: { coin: 0 },
  checkin_prompt: { show: true, server_date: "2026-07-22" },
  tasks: [{
    type: "checkin",
    detail: {
      continuous_days: 2,
      days: [{ day: 3, coin: 15, current: true, received: false }],
    },
  }],
};

test("check-in prompt waits for a fresh response but still fires when cached task data is unchanged", () => {
  const updates = [];
  const business = new ActivityCenterBusiness({
    onCheckinPromptUpdate: (...args) => updates.push(args),
  });

  business.applyActivityInfoData(activityInfo, { fromCache: true });
  assert.equal(updates.length, 1);
  assert.equal(updates[0][2].fromCache, true);

  business.applyActivityInfoData(activityInfo, { fromCache: false });
  assert.equal(updates.length, 2);
  assert.equal(updates[1][2].fromCache, false);
});
