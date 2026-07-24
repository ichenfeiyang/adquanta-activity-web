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
      normalizeAdMessage: (message) => message,
      checkinVideoClaimInFlight: { value: false },
      checkinWatchAdInFlight: { value: false },
      onCheckinVideoRewardClaimed: () => calls.push("reveal-chest"),
    });

    await handler({ eventType: "interstitial", taskId: "task_checkin", success: true, video_id: "video-1" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(calls, ["claim", "mark-completed", "reveal-chest"]);
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
      normalizeAdMessage: (message) => message,
      showDailyAdLimitToast: () => {},
      checkinChestAdInFlight: { value: true },
      checkinChestClaimInFlight: { value: false },
      getCheckinChest: () => ({ id: 9 }),
    });

    await handler({ eventType: "reward", taskId: "task_checkin_chest", success: true, ad_event_id: "ad-1" });

    assert.deepEqual(calls, ["loading:false", "hide-chest", "show-reward:15"]);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("uses the request-scoped event ID when the SDK coin-rain callback omits one", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = { ActivityBridgeHelper: { EventType: { REWARD_AD: "reward" } } };
  const calls = [];
  try {
    const handler = createActivitySdkEventHandler({
      business: {
        coinRain: { session_id: "rain-session", base_coin: 10 },
        submitCoinRainAction: async (_options, action, payload) => {
          calls.push({ action, payload });
          return { ok: true, base_coin: 10, boost_coin: 10 };
        },
      },
      ui: {
        setCoinRainAdLoading: () => {},
        showCoinRainBoostSuccess: () => calls.push("success"),
      },
      adapter: { trackEvent: () => {} },
      apiOptions: {},
      normalizeAdMessage: (message) => message,
      showDailyAdLimitToast: () => {},
      coinRainAdInFlight: { value: true },
    });

    await handler({
      eventType: "reward",
      taskId: "task_coin_rain",
      success: true,
      coin_rain_ad_event_id: "coin-rain-fallback-id",
    });

    assert.deepEqual(calls, [
      { action: "boost", payload: { session_id: "rain-session", ad_event_id: "coin-rain-fallback-id" } },
      "success",
    ]);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("uses the request-scoped event ID for a check-in chest when the SDK omits one", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = { ActivityBridgeHelper: { EventType: { REWARD_AD: "reward" } } };
  const claims = [];
  try {
    const handler = createActivitySdkEventHandler({
      business: {
        submitCheckinChestAction: async (_options, action, chestId, adEventId) => {
          claims.push({ action, chestId, adEventId });
          return { ok: true, coin: 15 };
        },
      },
      ui: {
        setCheckinChestLoading: () => {},
        hideCheckinChestDialog: () => {},
        showCheckinChestRewardDialog: () => {},
      },
      adapter: { trackEvent: () => {} },
      apiOptions: {},
      normalizeAdMessage: (message) => message,
      showDailyAdLimitToast: () => {},
      checkinChestAdInFlight: { value: true },
      checkinChestClaimInFlight: { value: false },
      checkinChestSettlingIds: new Set(),
      getCheckinChest: () => ({ id: 9 }),
    });

    await handler({
      eventType: "reward",
      taskId: "task_checkin_chest",
      success: true,
      request_ad_event_id: "checkin-chest-fallback-id",
    });

    assert.deepEqual(claims, [{ action: "claim", chestId: 9, adEventId: "checkin-chest-fallback-id" }]);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("keeps a chest locked when its reward claim is queued for retry", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = { ActivityBridgeHelper: { EventType: { REWARD_AD: "reward" } } };
  const settlingIds = new Set();
  try {
    const handler = createActivitySdkEventHandler({
      business: { submitCheckinChestAction: async () => ({ ok: false, queued: true }) },
      ui: {
        setCheckinChestLoading: () => {},
        hideCheckinChestDialog: () => {},
      },
      adapter: { trackEvent: () => {} },
      apiOptions: {},
      getLastRewardAdTaskId: () => "task_checkin_chest",
      normalizeAdMessage: (message) => message,
      showDailyAdLimitToast: () => {},
      checkinChestAdInFlight: { value: true },
      checkinChestClaimInFlight: { value: false },
      checkinChestSettlingIds: settlingIds,
      getCheckinChest: () => ({ id: 9 }),
    });

    await handler({ eventType: "reward", taskId: "task_checkin_chest", success: true, ad_event_id: "ad-1" });

    assert.deepEqual([...settlingIds], [9]);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("new-user bonus ad failure keeps the dialog actionable and reports the SDK message", async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  globalThis.window = {
    ActivityBridgeHelper: { EventType: { REWARD_AD: "reward" } },
    alert: () => {},
  };
  globalThis.document = { getElementById: () => null };
  const calls = [];
  try {
    const handler = createActivitySdkEventHandler({
      business: {},
      ui: {
        setNewUserBonusLoading: () => calls.push("loading"),
        restoreNewUserBonusVideoButton: () => calls.push("restore"),
      },
      adapter: { trackEvent: (name, payload) => calls.push([name, payload]) },
      apiOptions: {},
      getLastRewardAdTaskId: () => "task_new_user_bonus",
      normalizeAdMessage: (message) => `shown:${message}`,
      newUserBonusAdInFlight: { value: true },
      newUserBonusClaimInFlight: { value: false },
    });

    await handler({ eventType: "reward", success: false, message: "No ad available" });

    assert.equal(calls.includes("loading"), false);
    assert.equal(calls.includes("restore"), false);
    assert.deepEqual(calls, [["new_user_bonus_video_failed", {
      taskId: "task_new_user_bonus",
      reason: "shown:No ad available",
      adStatusCode: undefined,
      adErrorCode: undefined,
      adDetail: undefined,
    }]]);
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});

test("new-user bonus success claims the reward without disabling the dialog", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = { ActivityBridgeHelper: { EventType: { REWARD_AD: "reward" } } };
  const calls = [];
  const newUserBonusAdInFlight = { value: true };
  const newUserBonusClaimInFlight = { value: false };
  try {
    const handler = createActivitySdkEventHandler({
      business: {
        submitNewUserBonusAction: async (...args) => {
          calls.push(["claim", args]);
          return { ok: true };
        },
      },
      ui: {
        setNewUserBonusLoading: () => calls.push("loading"),
        hideNewUserBonusDialog: () => calls.push("hide"),
      },
      adapter: {
        getPlatform: () => "android",
        trackEvent: (name, payload) => calls.push([name, payload]),
      },
      apiOptions: { token: "test-token" },
      getLastRewardAdTaskId: () => "task_new_user_bonus",
      newUserBonusAdInFlight,
      newUserBonusClaimInFlight,
    });

    await handler({ eventType: "reward", success: true, ad_event_id: "ad-1" });

    assert.equal(newUserBonusAdInFlight.value, false);
    assert.equal(newUserBonusClaimInFlight.value, false);
    assert.equal(calls.includes("loading"), false);
    assert.deepEqual(calls, [
      ["claim", [{ token: "test-token" }, "claim_video", "ad-1"]],
      "hide",
      ["new_user_bonus_video_completed", {
        taskId: "task_new_user_bonus",
        success: true,
        platform: "android",
      }],
    ]);
  } finally {
    globalThis.window = originalWindow;
  }
});
