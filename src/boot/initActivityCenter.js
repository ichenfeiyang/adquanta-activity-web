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
import { ensureActivityLocaleFromSession, t } from "../lib/i18n/activity-locale.js";
import { reloadActivityPage } from "../lib/reload-activity-page.js";
import { createAdCallbackTimeout } from "../lib/ad-callback-timeout.js";
import { createActivitySdkEventHandler } from "../lib/activity-sdk-event-handlers.js";
import { getActivityInfoCache, isActivityInfoCacheFresh } from "../lib/activity-page-cache.js";
import {
  clearCheckinChestSoftClosed,
  markCheckinChestSoftClosed,
  readSoftClosedCheckinChestIds,
} from "../lib/checkin-chest.js";
import * as logger from "../lib/activity-logger.js";
import { isNoviceGuideCompleted, markNoviceGuideCompleted } from "../lib/novice-guide/novice-guide-state.js";
import { createNoviceGuide } from "../lib/novice-guide/create-novice-guide.js";
import "../assets/novice-guide.css";

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
    onCheckinChestWatchClick: showAuthRequired,
    onCheckinChestDismissClick: showAuthRequired,
    onCheckinChestDayClick: showAuthRequired,
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
  const checkinChestAdInFlight = { value: false };
  const checkinChestClaimInFlight = { value: false };
  const coinRainAdInFlight = { value: false };
  const coinRainStartInFlight = { value: false };
  const coinRainReconcileInFlight = { value: false };
  const AD_CALLBACK_TIMEOUT_MS = 60000;
  let ui;
  let adapter;
  let rewardAdTimeout;
  let interstitialAdTimeout;
  let newUserBonusAdTimeout;
  let checkinChestAdTimeout;
  let coinRainAdTimeout;
  let deferCheckinChestDialog = false;
  let deferredCheckinChest = null;

  function isCheckinChestSoftClosed(chestId) {
    return readSoftClosedCheckinChestIds().has(Number(chestId));
  }

  function updateCheckinChestDialog(chest, { force = false } = {}) {
    deferredCheckinChest = chest?.status === "pending" ? chest : null;
    if (!deferredCheckinChest) {
      ui.hideCheckinChestDialog();
      return;
    }
    if (deferCheckinChestDialog) return;
    const chestId = Number(deferredCheckinChest.id);
    // Always re-read sessionStorage so refresh / multi-path updates stay consistent.
    if (!force && isCheckinChestSoftClosed(chestId)) {
      ui.hideCheckinChestDialog();
      return;
    }
    if (force) clearCheckinChestSoftClosed(chestId);
    ui.showCheckinChestDialog(deferredCheckinChest);
  }

  function beginCheckinChestDeferral() {
    deferCheckinChestDialog = true;
  }

  function revealDeferredCheckinChest() {
    deferCheckinChestDialog = false;
    // First reveal after check-in; if user already tapped No thanks, stay closed.
    updateCheckinChestDialog(deferredCheckinChest);
  }

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
    onRecentRedemptionsUpdate: (items) => ui.updateRecentRedemptions(items),
    onCoinRainUpdate: (status) => {
      ui.updateCoinRain(status);
      // Kill/refresh mid-game leaves server in `playing`; PRD burns the day with no reward.
      // Skip while starting: submitCoinRainAction notifies update before local session exists.
      if (
        status?.state === "playing"
        && status?.session_id
        && !ui.hasActiveCoinRainSession()
        && !coinRainStartInFlight.value
        && !coinRainReconcileInFlight.value
      ) {
        coinRainReconcileInFlight.value = true;
        void business
          .submitCoinRainAction(apiOptions, "abandon", { session_id: status.session_id })
          .finally(() => {
            coinRainReconcileInFlight.value = false;
          });
      }
    },
    onNewUserBonusUpdate: (bonus) => {
      if (shouldShowNewUserBonus(bonus)) {
        ui.showNewUserBonusDialog(bonus);
      } else {
        ui.hideNewUserBonusDialog();
        // 无 Welcome Bonus 弹窗 → 直接启动新手引导
        startGuideIfReady();
      }
    },
    onCheckinChestUpdate: (chest) => {
      updateCheckinChestDialog(chest);
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
    checkinChestAdInFlight,
    checkinChestClaimInFlight,
    coinRainAdInFlight,
    onCheckinVideoRewardClaimed: () => {
      ui.hideSigninDialog();
      revealDeferredCheckinChest();
    },
    getCheckinChest: () => ui._checkinChest,
    get checkinChestAdTimeout() { return checkinChestAdTimeout; },
    get coinRainAdTimeout() { return coinRainAdTimeout; },
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
        beginCheckinChestDeferral();
        const result = await business.doCheckin(apiOptions);
        if (result.ok) ui.showSigninDialog(result);
        else {
          revealDeferredCheckinChest();
          // API 失败 → 弹窗不会出现，主动推进引导
          noviceGuide?.handleSigninDismiss();
        }
        return;
      }

      if (received && !videoReceived) {
        beginCheckinChestDeferral();
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

      const pendingChest = business.checkinChests?.[0];
      if (pendingChest?.id) {
        updateCheckinChestDialog(pendingChest, { force: true });
        return;
      }

      showToast(alreadyCheckedInMessage(), "info");
      // 已签到且已看视频、无待处理宝箱 → 弹窗不会出现，主动推进引导
      noviceGuide?.handleSigninDismiss();
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
    onSigninDialogDismiss: () => {
      if (noviceGuide?.handleSigninDismiss()) return;
      revealDeferredCheckinChest();
    },
    onSpinWheelDismiss: () => {
      noviceGuide?.handleSpinDismiss();
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
          // Welcome Bonus 弹窗已关闭 → 启动新手引导
          startGuideIfReady();
        } else {
          ui.setNewUserBonusLoading(false);
        }
      } finally {
        newUserBonusClaimInFlight.value = false;
      }
    },
    onCheckinChestWatchClick: async (chest) => {
      if (!chest?.id || checkinChestAdInFlight.value || checkinChestClaimInFlight.value) return;
      try {
        checkinChestAdInFlight.value = true;
        ui.setCheckinChestLoading(true);
        lastRewardAdTaskId = "task_checkin_chest";
        checkinChestAdTimeout?.start();
        adapter.trackEvent("checkin_chest_watch_video_click", { taskId: "task_checkin_chest", chestId: chest.id });
        await adapter.triggerRewardAd({ taskId: "task_checkin_chest", reward: 0 });
      } catch (error) {
        checkinChestAdTimeout?.clear();
        checkinChestAdInFlight.value = false;
        ui.setCheckinChestLoading(false);
        showToast(normalizeAdMessage(error?.message, adNotAvailableMessage()), "error");
      }
    },
    onCheckinChestDismissClick: async (chest) => {
      // Soft-close only: keep pending, suppress auto-popup across refresh, allow reopen from day node.
      if (chest?.id) markCheckinChestSoftClosed(chest.id);
      ui.hideCheckinChestDialog();
    },
    onCheckinChestDayClick: (chest) => {
      if (!chest?.id || checkinChestAdInFlight.value || checkinChestClaimInFlight.value) return;
      updateCheckinChestDialog(chest, { force: true });
    },
    onCoinRainEntryClick: async (status) => {
      if (coinRainStartInFlight.value || ui.hasActiveCoinRainSession()) return;
      if (status?.state === "boost_available") {
        ui.showCoinRainBoostPrompt(status);
        return;
      }
      if (status?.state === "playing" && status?.session_id && !ui.hasActiveCoinRainSession()) {
        coinRainStartInFlight.value = true;
        try {
          await business.submitCoinRainAction(apiOptions, "abandon", { session_id: status.session_id });
          adapter.trackEvent("coin_rain_abandon", { page_id: "activity-center", reason: "orphan_playing" });
        } finally {
          coinRainStartInFlight.value = false;
        }
        ui.showCoinRainAlreadyJoined();
        return;
      }
      if (status?.state !== "available") {
        ui.showCoinRainAlreadyJoined();
        return;
      }
      coinRainStartInFlight.value = true;
      try {
        const result = await business.submitCoinRainAction(apiOptions, "start");
        if (result?.ok && result?.state === "playing" && result?.session_id) {
          adapter.trackEvent("coin_rain_start", { page_id: "activity-center" });
          ui.startCoinRainSession(result);
        } else if (result?.ok) {
          // Idempotent start returned a finished/abandoned day session.
          ui.showCoinRainAlreadyJoined();
        } else {
          showToast(result?.message || t("center.coinRainUnavailable"), "error");
        }
      } finally {
        coinRainStartInFlight.value = false;
      }
    },
    onCoinRainSettle: async ({ sessionId, clickedCount }) => {
      const result = await business.submitCoinRainAction(apiOptions, "settle", { session_id: sessionId, clicked_count: clickedCount });
      adapter.trackEvent("coin_rain_finish", { page_id: "activity-center", clicked_count: clickedCount, success: !!result?.ok, base_coin: Number(result?.base_coin ?? 0) });
      return result;
    },
    onCoinRainAbandon: ({ sessionId }) => {
      void business.submitCoinRainAction(apiOptions, "abandon", { session_id: sessionId });
      adapter.trackEvent("coin_rain_abandon", { page_id: "activity-center" });
    },
    onCoinRainWatchAd: async (status) => {
      if (!status?.session_id || coinRainAdInFlight.value) return;
      try {
        coinRainAdInFlight.value = true;
        ui.setCoinRainAdLoading(true);
        lastRewardAdTaskId = "task_coin_rain";
        coinRainAdTimeout?.start();
        await adapter.triggerRewardAd({ taskId: "task_coin_rain", reward: Number(status.base_coin ?? 0) });
      } catch (error) {
        coinRainAdTimeout?.clear();
        coinRainAdInFlight.value = false;
        ui.setCoinRainAdLoading(false);
        showToast(normalizeAdMessage(error?.message, adNotAvailableMessage()), "error");
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

  checkinChestAdTimeout = createAdCallbackTimeout({
    ms: AD_CALLBACK_TIMEOUT_MS,
    isActive: () => checkinChestAdInFlight.value,
    onTimeout: () => {
      checkinChestAdInFlight.value = false;
      ui.setCheckinChestLoading(false);
      showToast(checkinChestAdTimeout.message, "warning");
      adapter.trackEvent("checkin_chest_ad_failed", { taskId: "task_checkin_chest", reason: "timeout" });
    },
  });

  coinRainAdTimeout = createAdCallbackTimeout({
    ms: AD_CALLBACK_TIMEOUT_MS,
    isActive: () => coinRainAdInFlight.value,
    onTimeout: () => {
      coinRainAdInFlight.value = false;
      ui.setCoinRainAdLoading(false);
      showToast(coinRainAdTimeout.message, "warning");
    },
  });

  window.onRewardedAdError = function (error) {
    logger.error("广告播放错误:", error);
    if (coinRainAdInFlight.value) {
      coinRainAdTimeout?.clear();
      coinRainAdInFlight.value = false;
      ui.setCoinRainAdLoading(false);
      showToast(normalizeAdMessage(error?.message, adFailedMessage()), "error");
      return;
    }
    if (checkinChestAdInFlight.value) {
      checkinChestAdTimeout?.clear();
      checkinChestAdInFlight.value = false;
      ui.setCheckinChestLoading(false);
      const message = normalizeAdMessage(error?.message, adFailedMessage());
      showToast(message, "error");
      adapter.trackEvent("checkin_chest_ad_failed", {
        taskId: "task_checkin_chest",
        error: error?.message || String(error),
      });
      return;
    }
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

  // ── 新手引导 ──
  let noviceGuide = null;
  let guideStarted = false;
  let onBeforeUnloadGuide = null;
  if (!isNoviceGuideCompleted()) {
    noviceGuide = createNoviceGuide({
      onStepAction: () => {},
      onComplete: () => {},
    });
    onBeforeUnloadGuide = () => {
      if (noviceGuide?.isGuideRunning()) markNoviceGuideCompleted();
    };
    window.addEventListener('beforeunload', onBeforeUnloadGuide);
  }

  function startGuideIfReady() {
    if (guideStarted || !noviceGuide) return;
    guideStarted = true;
    noviceGuide.start();
  }

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
    checkinChestAdTimeout?.clear();
    coinRainAdTimeout?.clear();
    ui.destroyRecentRedemptions();
    ui.destroyCoinRain();
    window.onRewardedAdError = null;
    window.ActivityBridgeHelper?.clearActivityEventCompleted?.();
    if (onBeforeUnloadGuide) {
      window.removeEventListener('beforeunload', onBeforeUnloadGuide);
    }
    noviceGuide?.dispose();
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
