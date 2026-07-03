import {
  ActivityCenterBusiness,
  getDailyAdLimitMessage,
} from "../lib/activity-center-business.js";
import { ActivityCenterAdapter } from "../lib/activity-center-adapter.js";
import { ActivityCenterUI } from "../lib/activity-center-ui.js";
import { goToGoldCoinsExchange } from "../lib/activity-navigation.js";
import { requireActivitySession } from "../lib/activity-session.js";
import { showToast } from "../lib/activity-alert-ui.js";
import {
  adFailedMessage,
  alreadyCheckedInMessage,
  adNotAvailableMessage,
  initializationFailedMessage,
  videoCheckinAlreadyMessage,
} from "../lib/activity-messages.js";
import { ensureActivityLocaleFromSession } from "../lib/i18n/activity-locale.js";
import { reloadActivityPage } from "../lib/reload-activity-page.js";
import { createAdCallbackTimeout } from "../lib/ad-callback-timeout.js";
import { createActivitySdkEventHandler } from "../lib/activity-sdk-event-handlers.js";
import { getActivityInfoCache, isActivityInfoCacheFresh } from "../lib/activity-page-cache.js";
import * as logger from "../lib/activity-logger.js";

/**
 * @param {{ router: import('vue-router').Router, route: import('vue-router').RouteLocationNormalizedLoaded }} ctx
 * @returns {(() => void) | undefined} dispose
 */
export function initActivityCenter({ router, route }) {
  const session = requireActivitySession(route, {
    defaultActivityId: "activity_center_202512",
    router,
  });
  if (!session) {
    logger.error("Missing token. Web auth disabled; open from app.");
    return;
  }

  const { code, activityId, apiOptions } = session;

  let lastRewardAdTaskId = "task_watch_ad";
  let lastInterstitialAdTaskId = "task_checkin";
  const checkinWatchAdInFlight = { value: false };
  const checkinVideoClaimInFlight = { value: false };
  const AD_CALLBACK_TIMEOUT_MS = 60000;
  let ui;
  let adapter;
  let rewardAdTimeout;
  let interstitialAdTimeout;

  function resetCheckinAdState() {
    checkinWatchAdInFlight.value = false;
    checkinVideoClaimInFlight.value = false;
    ui.setSigninWatchLoading(false);
  }

  function normalizeAdMessage(message, fallback = adFailedMessage()) {
    return business.resolveDailyAdMessage(message, fallback);
  }

  function showDailyAdLimitToast() {
    ui.handleRewardAdFailedForSpin(getDailyAdLimitMessage());
    ui.refreshAdTaskStats();
  }

  const business = new ActivityCenterBusiness({
    onAssetsUpdate: (assets) => ui.updateAssets(assets),
    onTaskUpdate: (tasks) => ui.updateTasks(tasks),
    onCheckinUpdate: (detail) => ui.updateCheckin(detail),
    onFeatureVisibilityUpdate: (visibility) => ui.updateFeatureVisibility(visibility),
  });

  const handleSDKEventCompleted = createActivitySdkEventHandler({
    business,
    get ui() {
      return ui;
    },
    get adapter() {
      return adapter;
    },
    apiOptions,
    getLastRewardAdTaskId: () => lastRewardAdTaskId,
    getLastInterstitialAdTaskId: () => lastInterstitialAdTaskId,
    get rewardAdTimeout() {
      return rewardAdTimeout;
    },
    get interstitialAdTimeout() {
      return interstitialAdTimeout;
    },
    normalizeAdMessage,
    showDailyAdLimitToast,
    checkinVideoClaimInFlight,
    checkinWatchAdInFlight,
  });

  adapter = new ActivityCenterAdapter({
    activityId,
    code,
    token: apiOptions.token,
    getUserId: () => business.getUserId(),
    onSDKReady: (session) => {
      if (ensureActivityLocaleFromSession(session)) {
        reloadActivityPage();
        return;
      }
      logger.log("SDK 初始化完成:", session);
    },
    onEventCompleted: handleSDKEventCompleted,
  });

  ui = new ActivityCenterUI({
    isDailyAdLimitReached: () => business.isDailyAdLimitReached(),
    getDailyAdLimitMessage: () => getDailyAdLimitMessage(),
    getAdTaskStatus: () => business.getAdTaskStatus(),
    onWatchAdClick: async () => {
      if (business.isDailyAdLimitReached()) {
        showDailyAdLimitToast();
        return;
      }
      try {
        const adTaskStatus = business.getAdTaskStatus();
        lastRewardAdTaskId = "task_watch_ad";
        rewardAdTimeout?.start();
        await adapter.triggerRewardAd({ taskId: "task_watch_ad", reward: adTaskStatus.reward });
      } catch (error) {
        rewardAdTimeout?.clear();
        const message = normalizeAdMessage(error?.message, adNotAvailableMessage());
        logger.error("[Ad trigger failed] reward_ad task_watch_ad", error);
        ui.handleRewardAdFailedForSpin(message);
        adapter.trackEvent("ad_watch_error", {
          taskId: "task_watch_ad",
          error: error?.message || String(error),
        });
      }
    },
    onSpinWheelOpen: async () => {
      const token = apiOptions.token || "";
      if (isActivityInfoCacheFresh(token)) {
        const cached = getActivityInfoCache(token);
        if (cached) {
          business.applyActivityInfoData(cached);
          return;
        }
      }
      await business.loadActivityInfo(apiOptions);
    },
    onSpinRequest: async () => {
      const result = await business.claimDailyVideoReward(apiOptions, "");
      if (!result?.ok) return { ok: false };
      return {
        ok: true,
        coin: Number(result.coin ?? 0),
        refreshAfterSpin: () => business.loadActivityInfo(apiOptions, { force: true }),
      };
    },
    onWithdrawClick: () => {
      goToGoldCoinsExchange(router, activityId);
    },
    onSigninClick: async () => {
      resetCheckinAdState();

      const today = business.getTodayCheckinDay();
      const received = !!today?.received;
      const videoReceived = !!today?.video_received;

      if (!received) {
        const result = await business.doCheckin(apiOptions);
        if (result.ok) ui.showSigninDialog(result);
        return;
      }

      if (received && !videoReceived) {
        const coin = Number(today?.coin ?? 0);
        const video_coin = Number(today?.video_coin ?? 0);
        const multiplier = coin > 0 ? Math.floor(video_coin / coin) : 0;
        ui.showSigninDialog({
          coinFromCheckin: coin,
          video_coin,
          multiplier,
          alreadyChecked: true,
        });
        return;
      }

      showToast(alreadyCheckedInMessage(), "info");
    },
    onSigninWatchVideoClick: async () => {
      if (ui.isSigninVideoCompleted()) {
        showToast(videoCheckinAlreadyMessage(), "info");
        return;
      }
      if (checkinWatchAdInFlight.value) return;
      try {
        checkinWatchAdInFlight.value = true;
        ui.setSigninWatchLoading(true);
        lastInterstitialAdTaskId = "task_checkin";
        const today = business.getTodayCheckinDay();
        logger.log("[签到弹框看视频] triggerInterstitialAd", {
          taskId: "task_checkin",
          reward: today?.video_coin,
          hasToday: !!today,
        });
        interstitialAdTimeout?.start();
        await adapter.triggerInterstitialAd({ taskId: "task_checkin", reward: today?.video_coin });
      } catch (e) {
        interstitialAdTimeout?.clear();
        checkinWatchAdInFlight.value = false;
        ui.setSigninWatchLoading(false);
        const message = normalizeAdMessage(e?.message, adNotAvailableMessage());
        logger.error("[Ad trigger failed] interstitial_ad task_checkin", e);
        showToast(message, "error");
        adapter.trackEvent("checkin_video_error", {
          taskId: "task_checkin",
          error: e?.message || String(e),
        });
      }
    },
  });

  rewardAdTimeout = createAdCallbackTimeout({
    ms: AD_CALLBACK_TIMEOUT_MS,
    isActive: () => ui.isWaitingAdForSpin(),
    onTimeout: () => {
      logger.warn("[Ad timeout] reward_ad task_watch_ad");
      ui.handleRewardAdFailedForSpin(rewardAdTimeout.message);
      adapter.trackEvent("ad_watch_timeout", { taskId: "task_watch_ad" });
    },
  });

  interstitialAdTimeout = createAdCallbackTimeout({
    ms: AD_CALLBACK_TIMEOUT_MS,
    isActive: () => checkinWatchAdInFlight.value,
    onTimeout: () => {
      logger.warn("[Ad timeout] interstitial_ad task_checkin");
      checkinWatchAdInFlight.value = false;
      ui.setSigninWatchLoading(false);
      showToast(interstitialAdTimeout.message, "warning");
      adapter.trackEvent("checkin_video_timeout", { taskId: "task_checkin" });
    },
  });

  window.onRewardedAdError = function (error) {
    rewardAdTimeout?.clear();
    logger.error("广告播放错误:", error);
    ui.handleRewardAdFailedForSpin(
      normalizeAdMessage(error?.message, adFailedMessage()),
    );
    adapter.trackEvent("ad_watch_error", {
      taskId: "task_watch_ad",
      error: error?.message || String(error),
    });
  };

  ui.bindEvents();
  ui.renderInitialShell();

  const cachedActivityInfo = getActivityInfoCache(apiOptions.token);
  if (cachedActivityInfo) {
    business.applyActivityInfoData(cachedActivityInfo);
  }

  void business.loadActivityInfo(apiOptions);

  scheduleGoldCoinsExchangePrefetch();

  adapter.init().catch((error) => {
    logger.error("初始化失败", error);
    showToast(initializationFailedMessage(), "error");
  });

  return function disposeActivityCenter() {
    rewardAdTimeout?.clear();
    interstitialAdTimeout?.clear();
    window.onRewardedAdError = null;
    window.ActivityBridgeHelper?.clearActivityEventCompleted?.();
  };
}

function scheduleGoldCoinsExchangePrefetch() {
  const run = () => {
    void import("./initGoldCoinsExchange.js");
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 3000 });
    return;
  }
  window.setTimeout(run, 2000);
}
