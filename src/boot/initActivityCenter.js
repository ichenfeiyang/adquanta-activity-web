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
import { ActivityAdRequestCoordinator } from "../lib/activity-ad-request-coordinator.js";
import { createActivitySdkEventHandler } from "../lib/activity-sdk-event-handlers.js";
import { getActivityInfoCache, isActivityInfoCacheFresh } from "../lib/activity-page-cache.js";
import {
  clearCheckinChestSoftClosed,
  markCheckinChestSoftClosed,
  readSoftClosedCheckinChestIds,
} from "../lib/checkin-chest.js";
import { dismissCheckinPrompt, shouldShowCheckinPrompt } from "../lib/checkin-prompt.js";
import { ACTIVITY_CENTER_PAGE_ID } from "../lib/activity-analytics.js";
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

  const adRequestCoordinator = new ActivityAdRequestCoordinator();
  const checkinWatchAdInFlight = { value: false };
  const checkinVideoClaimInFlight = { value: false };
  const newUserBonusAdInFlight = { value: false };
  const newUserBonusClaimInFlight = { value: false };
  const checkinChestAdInFlight = { value: false };
  const checkinChestClaimInFlight = { value: false };
  const coinRainAdInFlight = { value: false };
  const coinRainStartInFlight = { value: false };
  let ui;
  let adapter;
  let deferCheckinChestDialog = false;
  let deferredCheckinChest = null;
  let latestCheckinPrompt = null;
  let latestCheckinPromptDetail = null;
  let checkinPromptShownForDate = "";
  let newUserBonusVisible = false;
  let deferredNewUserBonus = null;
  const checkinChestDroppedIds = new Set();
  const checkinChestImpressedIds = new Set();
  const checkinChestSettlingIds = new Set();

  function showAdProcessingToast() {
    showToast(t("common.processing"), "info");
  }

  function beginAdRequest(eventType, taskId) {
    const request = adRequestCoordinator.begin(eventType, taskId);
    if (!request) showAdProcessingToast();
    return request;
  }

  async function triggerNativeAd(request, eventData) {
    try {
      if (request.eventType === "interstitial_ad") {
        await adapter.triggerInterstitialAd(eventData);
      } else {
        await adapter.triggerRewardAd(eventData);
      }
    } catch (error) {
      adRequestCoordinator.cancel(request);
      throw error;
    }
  }

  function isCheckinChestSoftClosed(chestId) {
    return readSoftClosedCheckinChestIds().has(Number(chestId));
  }

  function trackActivityEvent(eventType, eventData = {}) {
    return adapter?.trackEvent(eventType, { page_id: ACTIVITY_CENTER_PAGE_ID, ...eventData });
  }

  function updateCheckinChestDialog(chest, { force = false } = {}) {
    deferredCheckinChest = chest?.status === "pending" ? chest : null;
    if (!deferredCheckinChest) {
      checkinChestSettlingIds.clear();
      ui.hideCheckinChestDialog();
      return;
    }
    if (deferCheckinChestDialog) return;
    const chestId = Number(deferredCheckinChest.id);
    if (checkinChestSettlingIds.has(chestId)) {
      ui.hideCheckinChestDialog();
      return;
    }
    // Always re-read sessionStorage so refresh / multi-path updates stay consistent.
    if (!force && isCheckinChestSoftClosed(chestId)) {
      ui.hideCheckinChestDialog();
      return;
    }
    if (force) clearCheckinChestSoftClosed(chestId);
    if (Number.isSafeInteger(chestId) && chestId > 0 && !checkinChestDroppedIds.has(chestId)) {
      checkinChestDroppedIds.add(chestId);
      trackActivityEvent("checkin_chest_dropped", { task_id: "task_checkin_chest", chest_id: chestId });
    }
    ui.showCheckinChestDialog(deferredCheckinChest);
    if (Number.isSafeInteger(chestId) && chestId > 0 && !checkinChestImpressedIds.has(chestId)) {
      checkinChestImpressedIds.add(chestId);
      trackActivityEvent("checkin_chest_impression", { task_id: "task_checkin_chest", chest_id: chestId });
    }
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

  function updateCheckinPromptDialog(prompt, detail, { fromCache = false } = {}) {
    latestCheckinPrompt = prompt;
    latestCheckinPromptDetail = detail;
    const chestBlocksPrompt = !!deferredCheckinChest?.id
      && !isCheckinChestSoftClosed(deferredCheckinChest.id);
    if (fromCache || newUserBonusVisible || chestBlocksPrompt || !shouldShowCheckinPrompt(prompt)) {
      ui.hideCheckinPrompt();
      return;
    }
    const serverDate = String(prompt?.server_date || "");
    if (checkinPromptShownForDate === serverDate) return;
    checkinPromptShownForDate = serverDate;
    ui.showCheckinPrompt(detail, prompt);
    trackActivityEvent("checkin_prompt_impression", { server_date: serverDate });
  }

  async function claimTodayCheckin(source = "card") {
    resetCheckinAdState();

    const today = business.getTodayCheckinDay();
    const received = !!today?.received;
    const videoReceived = !!today?.video_received;

    if (!received) {
      beginCheckinChestDeferral();
      const result = await business.doCheckin(apiOptions);
      if (result.ok) {
        ui.showSigninDialog(result);
        trackActivityEvent("checkin_success", { source });
        return true;
      }
      trackActivityEvent("checkin_fail", { source, reason: result?.message || "checkin_failed" });
      revealDeferredCheckinChest();
      return false;
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
      return true;
    }

    const pendingChest = business.checkinChests?.[0];
    if (pendingChest?.id) {
      updateCheckinChestDialog(pendingChest, { force: true });
      return false;
    }

    showToast(alreadyCheckedInMessage(), "info");
    return false;
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
    },
    onNewUserBonusUpdate: (bonus) => {
      newUserBonusVisible = shouldShowNewUserBonus(bonus);
      if (!isNoviceGuideCompleted()) {
        // 引导未完成：延迟业务弹窗，直接启动引导
        deferredNewUserBonus = newUserBonusVisible ? bonus : null;
        ui.hideCheckinPrompt();
        ui.hideNewUserBonusDialog();
        startGuideIfReady();
      } else if (newUserBonusVisible) {
        ui.hideCheckinPrompt();
        ui.showNewUserBonusDialog(bonus);
      } else {
        ui.hideNewUserBonusDialog();
        updateCheckinPromptDialog(latestCheckinPrompt, latestCheckinPromptDetail);
      }
    },
    onCheckinChestUpdate: (chest) => {
      updateCheckinChestDialog(chest);
    },
    onCheckinPromptUpdate: (prompt, detail, metadata) => {
      // 引导未完成时静默忽略签到提示（让位给新手引导）
      if (!isNoviceGuideCompleted() && !guideStarted && !noviceGuide?.isGuideRunning()) {
        return;
      }
      updateCheckinPromptDialog(prompt, detail, metadata);
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
    normalizeAdMessage,
    showDailyAdLimitToast,
    checkinVideoClaimInFlight,
    checkinWatchAdInFlight,
    newUserBonusAdInFlight,
    newUserBonusClaimInFlight,
    checkinChestAdInFlight,
    checkinChestClaimInFlight,
    checkinChestSettlingIds,
    coinRainAdInFlight,
    onCheckinVideoRewardClaimed: () => {
      ui.hideSigninDialog();
      revealDeferredCheckinChest();
    },
    getCheckinChest: () => ui._checkinChest,
  });

  const handleSerializedSdkEvent = async (result) => {
    const request = adRequestCoordinator.take(result?.eventType);
    if (!request) {
      logger.warn("Ignoring duplicate or stale SDK ad callback", result);
      return;
    }
    await handleSDKEventCompleted({
      ...result,
      taskId: request.taskId,
      task_id: request.taskId,
    });
  };

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
    onEventCompleted: handleSerializedSdkEvent,
  });

  ui = new ActivityCenterUI({
    isDailyAdLimitReached: () => business.isDailyAdLimitReached(),
    getDailyAdLimitMessage: () => getDailyAdLimitMessage(),
    getAdTaskStatus: () => business.getAdTaskStatus(),
    onWatchAdClick: async () => {
      if (business.isDailyAdLimitReached()) {
        showDailyAdLimitToast();
        return false;
      }
      const request = beginAdRequest("reward_ad", "task_watch_ad");
      if (!request) {
        ui.cancelPendingSpinAd();
        return false;
      }
      try {
        const adTaskStatus = business.getAdTaskStatus();
        await triggerNativeAd(request, { taskId: "task_watch_ad", reward: adTaskStatus.reward });
        return true;
      } catch (error) {
        const message = normalizeAdMessage(error?.message, adNotAvailableMessage());
        logger.error("[Ad trigger failed] reward_ad task_watch_ad", error);
        ui.handleRewardAdFailedForSpin(message, { showFailureToast: false });
        adapter.trackEvent("ad_watch_error", {
          taskId: "task_watch_ad",
          error: error?.message || String(error),
        });
        // 广告未接入时：关闭转盘弹窗，推进新手引导
        ui.hideSpinWheel();
        noviceGuide?.handleSpinDismiss();
        return false;
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
      const success = await claimTodayCheckin("card");
      if (!success) noviceGuide?.handleSigninDismiss();
    },
    onCheckinPromptClaim: async ({ prompt } = {}) => {
      const serverDate = String(prompt?.server_date || "");
      ui.hideCheckinPrompt();
      trackActivityEvent("checkin_prompt_claim_click", { server_date: serverDate });
      const success = await claimTodayCheckin("prompt");
      if (!success && shouldShowCheckinPrompt(prompt)) {
        checkinPromptShownForDate = "";
        updateCheckinPromptDialog(prompt, latestCheckinPromptDetail);
      }
    },
    onCheckinPromptClose: ({ prompt } = {}) => {
      const serverDate = String(prompt?.server_date || "");
      dismissCheckinPrompt(serverDate);
      ui.hideCheckinPrompt();
      trackActivityEvent("checkin_prompt_close", { server_date: serverDate });
    },
    onSigninWatchVideoClick: async () => {
      if (ui.isSigninVideoCompleted()) {
        showToast(videoCheckinAlreadyMessage(), "info");
        return;
      }
      if (checkinWatchAdInFlight.value) {
        showAdProcessingToast();
        return;
      }
      const request = beginAdRequest("interstitial_ad", "task_checkin");
      if (!request) return;
      try {
        checkinWatchAdInFlight.value = true;
        ui.setSigninWatchLoading(true);
        const today = business.getTodayCheckinDay();
        logger.log("[签到弹框看视频] triggerInterstitialAd", {
          taskId: "task_checkin",
          reward: today?.video_coin,
          hasToday: !!today,
        });
        await triggerNativeAd(request, { taskId: "task_checkin", reward: today?.video_coin });
      } catch (e) {
        checkinWatchAdInFlight.value = false;
        ui.setSigninWatchLoading(false);
        const message = normalizeAdMessage(e?.message, adNotAvailableMessage());
        logger.error("[Ad trigger failed] interstitial_ad task_checkin", e);
        adapter.trackEvent("checkin_video_error", {
          taskId: "task_checkin",
          reason: message,
          error: e?.message || String(e),
        });
        // 广告未接入时：关闭签到弹窗，推进新手引导
        ui.hideSigninDialog();
        noviceGuide?.handleSigninDismiss();
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
      if (newUserBonusAdInFlight.value || newUserBonusClaimInFlight.value) {
        showAdProcessingToast();
        return;
      }
      const request = beginAdRequest("reward_ad", "task_new_user_bonus");
      if (!request) return;
      try {
        newUserBonusAdInFlight.value = true;
        await triggerNativeAd(request, {
          taskId: "task_new_user_bonus",
          reward: bonus?.video_coin,
        });
      } catch (error) {
        newUserBonusAdInFlight.value = false;
        const message = normalizeAdMessage(error?.message, adNotAvailableMessage());
        logger.error("[Ad trigger failed] reward_ad task_new_user_bonus", error);
        adapter.trackEvent("new_user_bonus_video_error", {
          taskId: "task_new_user_bonus",
          reason: message,
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
      if (!chest?.id) return;
      if (checkinChestAdInFlight.value || checkinChestClaimInFlight.value) {
        showAdProcessingToast();
        return;
      }
      const request = beginAdRequest("reward_ad", "task_checkin_chest");
      if (!request) return;
      try {
        checkinChestAdInFlight.value = true;
        ui.setCheckinChestLoading(true);
        // H5 owns this click event; Native should not emit the same name to avoid double counting.
        adapter.trackEvent("checkin_chest_watch_video_click", {
          page_id: ACTIVITY_CENTER_PAGE_ID,
          task_id: "task_checkin_chest",
          chest_id: chest.id,
        });
        await triggerNativeAd(request, { taskId: "task_checkin_chest", reward: 0 });
      } catch (error) {
        checkinChestAdInFlight.value = false;
        ui.setCheckinChestLoading(false);
        const reason = normalizeAdMessage(error?.message, adNotAvailableMessage());
        trackActivityEvent("checkin_chest_ad_failed", {
          task_id: "task_checkin_chest",
          chest_id: chest?.id,
          reason,
        });
      }
    },
    onCheckinChestDismissClick: async (chest) => {
      // Soft-close only: keep pending, suppress auto-popup across refresh, allow reopen from day node.
      if (chest?.id) {
        markCheckinChestSoftClosed(chest.id);
        checkinChestImpressedIds.delete(Number(chest.id));
        trackActivityEvent("checkin_chest_dismiss", {
          task_id: "task_checkin_chest",
          chest_id: chest.id,
        });
      }
      ui.hideCheckinChestDialog();
    },
    onCheckinChestDayClick: (chest) => {
      if (!chest?.id || checkinChestAdInFlight.value || checkinChestClaimInFlight.value) return;
      if (checkinChestSettlingIds.has(Number(chest.id))) {
        showToast(t("center.checkinChestProcessing"), "info");
        return;
      }
      updateCheckinChestDialog(chest, { force: true });
    },
    onCoinRainEntryClick: async (status) => {
      if (coinRainStartInFlight.value) return;
      if (ui.hasPendingCoinRainSettlement()) {
        ui.retryCoinRainSettlement();
        return;
      }
      if (ui.hasActiveCoinRainSession()) return;
      if (status?.state === "boost_available") {
        ui.showCoinRainBoostPrompt(status);
        return;
      }
      if (status?.state === "playing" && status?.session_id && !ui.hasActiveCoinRainSession()) {
        trackActivityEvent("coin_rain_resume");
        ui.startCoinRainSession(status, { resume: true });
        return;
      }
      if (status?.state === "settle_pending" && status?.session_id) {
        // Only a locally preserved session may settle here. Never recreate the
        // game after its deadline, otherwise its click count would be zero.
        if (ui.restoreCoinRainSettlement(status)) ui.retryCoinRainSettlement();
        else showToast(t("center.coinRainSettleFailed"), "error");
        return;
      }
      if (status?.state === "completed") {
        ui.showCoinRainAlreadyJoined();
        return;
      }
      if (status?.state !== "available") {
        ui.showCoinRainAlreadyJoined();
        return;
      }
      ui.startCoinRainPreparation(status, async () => {
        coinRainStartInFlight.value = true;
        try {
          const result = await business.submitCoinRainAction(apiOptions, "start");
          if (result?.ok && result?.state === "playing" && result?.session_id) {
            if (!ui.isCoinRainPreparationActive()) {
              await business.submitCoinRainAction(apiOptions, "abandon", { session_id: result.session_id });
              return;
            }
            trackActivityEvent("coin_rain_start");
            ui.startCoinRainSession(result, { skipCountdown: true });
          } else if (result?.ok) {
            ui.cancelCoinRainPreparation();
            ui.showCoinRainAlreadyJoined();
          } else {
            ui.cancelCoinRainPreparation();
            showToast(result?.message || t("center.coinRainUnavailable"), "error");
          }
        } finally {
          coinRainStartInFlight.value = false;
        }
      });
    },
    onCoinRainSettle: async ({ sessionId, clickedCount }) => {
      let result = await business.submitCoinRainAction(apiOptions, "settle", { session_id: sessionId, clicked_count: clickedCount });
      let reconciled = false;
      if (!result?.ok) {
        const refreshed = await business.loadActivityInfo(apiOptions, { force: true });
        const status = business.coinRain;
        // Treat any terminal settle state as success, including legitimate 0-coin
        // finishes. Requiring coin > 0 falsely retried settled zero-click sessions.
        if (
          refreshed?.ok
          && status
          && (status.state === "boost_available" || status.state === "completed")
        ) {
          reconciled = true;
          result = { ok: true, reconciled: true, ...status };
        }
      }
      trackActivityEvent("coin_rain_finish", {
        clicked_count: clickedCount,
        success: !!result?.ok,
        base_coin: Number(result?.base_coin ?? 0),
        reconciled,
      });
      return result;
    },
    onCoinRainAbandon: async ({ sessionId }) => {
      const result = await business.submitCoinRainAction(apiOptions, "abandon", { session_id: sessionId });
      trackActivityEvent("coin_rain_abandon", { success: !!result?.ok });
      return result;
    },
    onCoinRainWatchAd: async (status) => {
      if (!status?.session_id) return;
      if (coinRainAdInFlight.value) {
        showAdProcessingToast();
        return;
      }
      const request = beginAdRequest("reward_ad", "task_coin_rain");
      if (!request) return;
      try {
        coinRainAdInFlight.value = true;
        ui.setCoinRainAdLoading(true);
        trackActivityEvent("coin_rain_boost_click", {
          task_id: "task_coin_rain",
          session_id: status.session_id,
          base_coin: Number(status.base_coin ?? 0),
        });
        await triggerNativeAd(request, { taskId: "task_coin_rain", reward: Number(status.base_coin ?? 0) });
      } catch (error) {
        coinRainAdInFlight.value = false;
        ui.setCoinRainAdLoading(false);
        const reason = normalizeAdMessage(error?.message, adNotAvailableMessage());
        trackActivityEvent("coin_rain_ad_failed", { task_id: "task_coin_rain", reason });
        // 广告未接入时：关闭金币雨结果弹窗，推进新手引导
        ui.hideCoinRainResult();
        noviceGuide?.handleCoinRainDismiss();
      }
    },
    onCoinRainResultDismiss: () => {
      noviceGuide?.handleCoinRainDismiss();
    },
  });

  window.onRewardedAdError = function (error) {
    logger.error("广告播放错误:", error);
    const request = adRequestCoordinator.take("reward_ad");
    if (!request) return;
    void handleSDKEventCompleted({
      eventType: "reward_ad",
      taskId: request.taskId,
      task_id: request.taskId,
      success: false,
      message: error?.message || adFailedMessage(),
      adStatusCode: error?.code,
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
      onComplete: () => {
        // 引导完成 → 回放被延迟的业务弹窗
        if (deferredNewUserBonus && shouldShowNewUserBonus(deferredNewUserBonus)) {
          newUserBonusVisible = true;
          ui.showNewUserBonusDialog(deferredNewUserBonus);
          deferredNewUserBonus = null;
        }
      },
      onStart: () => {
        adapter.trackEvent('rewards_onboarding_start_click', {
          page_id: '/activity-center',
          element_id: 'OK_button',
          element_name: '点击开始引导',
        });
      },
      onSkip: () => {
        adapter.trackEvent('rewards_onboarding_skip_click', {
          page_id: '/activity-center',
          element_id: 'Skip_button',
          element_name: '点击跳过引导',
        });
      },
    });
    onBeforeUnloadGuide = () => {
      if (noviceGuide?.isGuideRunning()) markNoviceGuideCompleted();
    };
    window.addEventListener('beforeunload', onBeforeUnloadGuide);
  }

  // 新手引导启动前需要等待关闭的业务弹窗
  // 这些弹窗始终在 DOM 中，通过 style.display 控制显隐
  const GUIDE_BLOCKING_MODALS = [
    '#checkinPromptModal',
    '#newUserBonusModal',
    '#checkinChestModal',
  ];

  function hasVisibleBlockingModal() {
    return GUIDE_BLOCKING_MODALS.some(sel => {
      const el = document.querySelector(sel);
      return el && el.style.display !== 'none';
    });
  }

  let guideWaitObserver = null;
  let guideWaitTimer = null;

  function waitForModalsThenStart() {
    if (guideWaitObserver) { guideWaitObserver.disconnect(); }
    if (guideWaitTimer) { clearTimeout(guideWaitTimer); }

    guideWaitObserver = new MutationObserver(() => {
      if (!hasVisibleBlockingModal()) {
        guideWaitObserver.disconnect();
        guideWaitObserver = null;
        if (!guideStarted && noviceGuide) {
          guideStarted = true;
          noviceGuide.start();
        }
      }
    });

    guideWaitObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });

    // 兜底超时
    guideWaitTimer = setTimeout(() => {
      if (guideWaitObserver) { guideWaitObserver.disconnect(); guideWaitObserver = null; }
      if (!guideStarted && noviceGuide) {
        guideStarted = true;
        noviceGuide.start();
      }
    }, 10000);
  }

  function startGuideIfReady() {
    if (guideStarted || !noviceGuide) return;

    // 情况1：当前有业务弹窗在显示 → 等它关闭
    if (hasVisibleBlockingModal()) {
      waitForModalsThenStart();
      return;
    }

    // 情况2：当前无弹窗，但签到提示数据可能还没到
    // 等待一小段时间，看是否有弹窗出现
    const checkTimer = setTimeout(() => {
      if (guideStarted) return;
      if (hasVisibleBlockingModal()) {
        waitForModalsThenStart();
      } else {
        guideStarted = true;
        noviceGuide.start();
      }
    }, 300);

    // 兜底超时：防止任何情况导致引导不启动
    guideWaitTimer = setTimeout(() => {
      clearTimeout(checkTimer);
      if (!guideStarted && noviceGuide) {
        guideStarted = true;
        noviceGuide.start();
      }
    }, 5000);
  }

  const cachedActivityInfo = getActivityInfoCache(apiOptions.token);
  if (cachedActivityInfo) {
    business.applyActivityInfoData(cachedActivityInfo, { fromCache: true });
  }

  // The prompt must use a fresh server decision so a cached pre-midnight state
  // cannot incorrectly surface (or hide) today's check-in reminder.
  void business.loadActivityInfo(apiOptions, { force: true });

  scheduleGoldCoinsExchangePrefetch();

  adapter.init().catch((error) => {
    logger.error("初始化失败", error);
    showToast(initializationFailedMessage(), "error");
  });

  return function disposeActivityCenter() {
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
