import test from "node:test";
import assert from "node:assert/strict";

import { createActivitySdkEventHandler } from "./activity-sdk-event-handlers.js";

test("reveals a deferred chest only after the check-in video reward is settled", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = { ActivityBridgeHelper: { EventType: { INTERSTITIAL_AD: "interstitial" } } };
  const calls = [];
  try {
    const handler = createActivitySdkEventHandler({
      business: {
        claimCheckinVideoReward: async () => {
          calls.push("claim");
          return { ok: true };
        },
      },
      ui: {
        markSigninVideoCompleted: () => calls.push("mark-completed"),
        showCheckinChestRewardDialog: (coin) => calls.push(`show-reward:${coin}`),
        isSigninVideoCompleted: () => true,
        setSigninWatchLoading: () => calls.push("stop-loading"),
      },
      adapter: { trackEvent: () => {} },
      apiOptions: {},
      getLastInterstitialAdTaskId: () => "task_checkin",
      interstitialAdTimeout: { clear: () => calls.push("clear-timeout") },
      normalizeAdMessage: (message) => message,
      checkinVideoClaimInFlight: { value: false },
      checkinWatchAdInFlight: { value: false },
      onCheckinVideoRewardClaimed: () => calls.push("reveal-chest"),
    });

    await handler({ eventType: "interstitial", taskId: "task_checkin", success: true, video_id: "video-1" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(calls, ["clear-timeout", "claim", "mark-completed", "reveal-chest"]);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("shows the chest reward result dialog after the chest ad is settled", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = { ActivityBridgeHelper: { EventType: { REWARD_AD: "reward" } } };
  const calls = [];
  try {
    const handler = createActivitySdkEventHandler({
      business: {
        submitCheckinChestAction: async () => ({ ok: true, coin: 15 }),
      },
      ui: {
        setCheckinChestLoading: (loading) => calls.push(`loading:${loading}`),
        hideCheckinChestDialog: () => calls.push("hide-chest"),
        showCheckinChestRewardDialog: (coin) => calls.push(`show-reward:${coin}`),
      },
      adapter: { trackEvent: () => {} },
      apiOptions: {},
      getLastRewardAdTaskId: () => "task_checkin_chest",
      rewardAdTimeout: { clear: () => {} },
      newUserBonusAdTimeout: { clear: () => {} },
      checkinChestAdTimeout: { clear: () => calls.push("clear-timeout") },
      normalizeAdMessage: (message) => message,
      showDailyAdLimitToast: () => {},
      checkinChestAdInFlight: { value: true },
      checkinChestClaimInFlight: { value: false },
      getCheckinChest: () => ({ id: 9 }),
    });

    await handler({ eventType: "reward", taskId: "task_checkin_chest", success: true, ad_event_id: "ad-1" });

    assert.deepEqual(calls, ["clear-timeout", "loading:false", "hide-chest", "show-reward:15"]);
  } finally {
    globalThis.window = originalWindow;
  }
});
