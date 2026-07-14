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
  authFailedMessage,
  initializationFailedMessage,
  videoCheckinAlreadyMessage,
} from "../lib/activity-messages.js";
import { ensureActivityLocaleFromSession } from "../lib/i18n/activity-locale.js";
import { reloadActivityPage } from "../lib/reload-activity-page.js";
import { createAdCallbackTimeout } from "../lib/ad-callback-timeout.js";
import { createActivitySdkEventHandler } from "../lib/activity-sdk-event-handlers.js";
import { getActivityInfoCache, isActivityInfoCacheFresh } from "../lib/activity-page-cache.js";
import * as logger from "../lib/activity-logger.js";

function renderUnauthenticatedActivityCenterPreview() {
  const showAuthRequired = () => showToast(authFailedMessage(), "error");
  const ui = new ActivityCenterUI({
    onWatchAdClick: showAuthRequired,
    onSpinWheelOpen: showAuthRequired,
    onSpinRequest: async () => {
      showAuthRequired();
      return { ok: false };
    },
    onWithdrawClick: showAuthRequired,
    onSigninClick: showAuthRequired,
    onSigninWatchVideoClick: showAuthRequired,
    onNewUserBonusVideoClick: showAuthRequired,
    onNewUserBonusDismissClick: showAuthRequired,
  });
  ui.bindEvents();
  ui.renderInitialShell();
}

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
    renderUnauthenticatedActivityCenterPreview();
    return;
  }

  const { code, activityId, apiOptions } = session;

  let lastRewardAdTaskId = "task_watch_ad";
  let lastInterstitialAdTaskId = "task_checkin";
  const checkinWatchAdInFlight = { value: false };
  const checkinVideoClaimInFlight = { value: false };
  const newUserBonusAdInFlight = { value: false };
  const newUserBonusClaimInFlight = { value: false };
  const AD_CALLBACK_TIMEOUT_MS = 60000;
  let ui;
  let adapter;
  let rewardAdTimeout;
  let interstitialAdTimeout;
  let newUserBonusAdTimeout;

  function resetCheckinAdState() {
    checkinWatchAdInFlight.value = false;
    checkinVideoClaimInFlight.value = false;
    ui.setSigninWatchLoading(false);
  }

  function shouldShowNewUserBonus(bonus) {
    return bonus?.eligible === true && bonus?.show === true && bonus?.status === "pending";
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
    onRedeemGapUpdate: (gap) => ui.updateRedeemGap(gap),
    onRedeemRewardsUpdate: (rewards) => ui.updateRedeemRewards(rewards),
    onNewUserBonusUpdate: (bonus) => {
      if (shouldShowNewUserBonus(bonus)) {
        ui.showNewUserBonusDialog(bonus);
      } else {
        ui.hideNewUserBonusDialog();
      }
    },
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
    get newUserBonusAdTimeout() {
      return newUserBonusAdTimeout;
    },
    normalizeAdMessage,
    showDailyAdLimitToast,
    checkinVideoClaimInFlight,
    checkinWatchAdInFlight,
    newUserBonusAdInFlight,
    newUserBonusClaimInFlight,
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
    onWithdrawClick: (category) => {
      if (!category) {
        goToGoldCoinsExchange(router, activityId);
        return;
      }
      goToGoldCoinsExchange(router, activityId, {
        tab: category === "gift_cards" ? "gift" : "topup",
      });
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
    onNewUserBonusVideoClick: async (bonus) => {
      if (newUserBonusAdInFlight.value || newUserBonusClaimInFlight.value) return;
      try {
        newUserBonusAdInFlight.value = true;
        ui.setNewUserBonusLoading(true, "video");
        lastRewardAdTaskId = "task_new_user_bonus";
        newUserBonusAdTimeout?.start();
        await adapter.triggerRewardAd({
          taskId: "task_new_user_bonus",
          reward: bonus?.video_coin,
        });
      } catch (error) {
        newUserBonusAdTimeout?.clear();
        newUserBonusAdInFlight.value = false;
        ui.setNewUserBonusLoading(false);
        ui.restoreNewUserBonusVideoButton();
        const message = normalizeAdMessage(error?.message, adNotAvailableMessage());
        logger.error("[Ad trigger failed] reward_ad task_new_user_bonus", error);
        showToast(message, "error");
        adapter.trackEvent("new_user_bonus_video_error", {
          taskId: "task_new_user_bonus",
          error: error?.message || String(error),
        });
      }
    },
    onNewUserBonusDismissClick: async () => {
      if (newUserBonusClaimInFlight.value) return;
      newUserBonusClaimInFlight.value = true;
      ui.setNewUserBonusLoading(true, "dismiss");
      try {
        const result = await business.submitNewUserBonusAction(apiOptions, "dismiss");
        if (result?.ok) {
          ui.hideNewUserBonusDialog();
        } else {
          ui.setNewUserBonusLoading(false);
        }
      } finally {
        newUserBonusClaimInFlight.value = false;
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

  newUserBonusAdTimeout = createAdCallbackTimeout({
    ms: AD_CALLBACK_TIMEOUT_MS,
    isActive: () => newUserBonusAdInFlight.value,
    onTimeout: () => {
      logger.warn("[Ad timeout] reward_ad task_new_user_bonus");
      newUserBonusAdInFlight.value = false;
      ui.setNewUserBonusLoading(false);
      ui.restoreNewUserBonusVideoButton();
      showToast(newUserBonusAdTimeout.message, "warning");
      adapter.trackEvent("new_user_bonus_video_timeout", { taskId: "task_new_user_bonus" });
    },
  });

  window.onRewardedAdError = function (error) {
    logger.error("广告播放错误:", error);
    if (newUserBonusAdInFlight.value) {
      newUserBonusAdTimeout?.clear();
      newUserBonusAdInFlight.value = false;
      ui.setNewUserBonusLoading(false);
      ui.restoreNewUserBonusVideoButton();
      const message = normalizeAdMessage(error?.message, adFailedMessage());
      showToast(message, "error");
      adapter.trackEvent("new_user_bonus_video_error", {
        taskId: "task_new_user_bonus",
        error: error?.message || String(error),
      });
      return;
    }
    rewardAdTimeout?.clear();
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
    newUserBonusAdTimeout?.clear();
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
