import {
  DAILY_AD_LIMIT_MESSAGE,
  WelfareCenterBusiness as ActivityCenterBusiness,
} from "../lib/activity-center-business.js";
import { WelfareCenterAdapter as ActivityCenterAdapter } from "../lib/activity-center-adapter.js";
import { WelfareCenterUI as ActivityCenterUI } from "../lib/activity-center-ui.js";
import { BaseApiUrl } from "../lib/activity-api.js";
import {
  readSameOriginReferrerSearchParams,
  resolveEntryToken,
  stripTokenFromUrl,
} from "../lib/activity-auth.js";
import { getActivityInfoCache } from "../lib/activity-page-cache.js";
import * as logger from "../lib/activity-logger.js";

/**
 * 活动中心页初始化（由原 activity-center.html 内联脚本迁移；DOM 结构需已挂载）
 * @param {{ router: import('vue-router').Router, route: import('vue-router').RouteLocationNormalizedLoaded }} ctx
 * @returns {() => void} dispose — call on route unmount to clear SDK callbacks and timers
 */
export function initActivityCenter({ router, route }) {
  const qp = new URLSearchParams(window.location.search);
  const refQp = readSameOriginReferrerSearchParams();
  const rq = route?.query || {};
  const code = qp.get("code") || refQp.get("code") || String(rq.code || "");
  const activityId = String(
    rq.activity_id || qp.get("activity_id") || refQp.get("activity_id") || "activity_center_202512",
  );

  function showAuthFailedDialog() {
    const modal = document.getElementById("authFailedModal");
    if (modal) modal.style.display = "flex";
    const ok = document.getElementById("authFailedOk");
    if (ok) {
      ok.addEventListener(
        "click",
        () => {
          if (modal) modal.style.display = "none";
        },
        { once: true },
      );
    }
  }

  const channelTag = "";

  const token = resolveEntryToken({ routeQuery: rq });
  stripTokenFromUrl();

  if (!token) {
    logger.error("Missing token. Web auth disabled; open from app.");
    showAuthFailedDialog();
    return;
  }

  const apiOptions = {
    baseUrl: BaseApiUrl,
    token,
  };

  let lastRewardAdTaskId = "task_watch_ad";
  let lastInterstitialAdTaskId = "task_checkin";
  let checkinWatchAdInFlight = false;
  let checkinVideoClaimInFlight = false;
  const AD_CALLBACK_TIMEOUT_MS = 60000;
  let rewardAdTimeoutId = null;
  let interstitialAdTimeoutId = null;
  let ui;
  let adapter;

  function resetCheckinAdState() {
    checkinWatchAdInFlight = false;
    checkinVideoClaimInFlight = false;
    ui.setSigninWatchLoading(false);
  }

  function normalizeAdMessage(message, fallback = "Ad failed to play, please try again") {
    return business.resolveDailyAdMessage(message, fallback);
  }

  function showDailyAdLimitToast() {
    ui.handleRewardAdFailedForSpin(DAILY_AD_LIMIT_MESSAGE);
    ui.refreshAdTaskStats();
  }

  function clearRewardAdTimeout() {
    if (rewardAdTimeoutId) {
      clearTimeout(rewardAdTimeoutId);
      rewardAdTimeoutId = null;
    }
  }

  function clearInterstitialAdTimeout() {
    if (interstitialAdTimeoutId) {
      clearTimeout(interstitialAdTimeoutId);
      interstitialAdTimeoutId = null;
    }
  }

  function startRewardAdTimeout() {
    clearRewardAdTimeout();
    rewardAdTimeoutId = setTimeout(() => {
      rewardAdTimeoutId = null;
      if (!ui.isWaitingAdForSpin()) return;
      const message = "Ad did not respond, please try again";
      logger.warn("[Ad timeout] reward_ad task_watch_ad");
      ui.handleRewardAdFailedForSpin(message);
      adapter.trackEvent("ad_watch_timeout", { taskId: "task_watch_ad" });
    }, AD_CALLBACK_TIMEOUT_MS);
  }

  function startInterstitialAdTimeout() {
    clearInterstitialAdTimeout();
    interstitialAdTimeoutId = setTimeout(() => {
      interstitialAdTimeoutId = null;
      if (!checkinWatchAdInFlight) return;
      const message = "Ad did not respond, please try again";
      logger.warn("[Ad timeout] interstitial_ad task_checkin");
      checkinWatchAdInFlight = false;
      ui.setSigninWatchLoading(false);
      ui.showToast(message, "warning");
      adapter.trackEvent("checkin_video_timeout", { taskId: "task_checkin" });
    }, AD_CALLBACK_TIMEOUT_MS);
  }

  const business = new ActivityCenterBusiness({
    onAssetsUpdate: (assets) => ui.updateAssets(assets),
    onTaskUpdate: (tasks) => ui.updateTasks(tasks),
    onCheckinUpdate: (detail) => ui.updateCheckin(detail),
    onFeatureVisibilityUpdate: (visibility) => ui.updateFeatureVisibility(visibility),
    onUserInfoUpdate: (data) => ui.updateUserDisplay(data?.user_id),
    onToast: (message, type) => ui.showToast(message, type),
  });

  adapter = new ActivityCenterAdapter({
    activityId,
    code,
    token,
    channelTag,
    onSDKReady: (session) => {
      logger.log("SDK 初始化完成:", session);
    },
    onEventCompleted: (result) => {
      handleSDKEventCompleted(result);
    },
  });

  async function handleSDKEventCompleted(result) {
    logger.log("活动事件完成回调:", result);

    if (!result || !result.eventType) {
      logger.warn("事件完成回调数据格式错误:", result);
      return;
    }

    const eventType = result.eventType;
    const success = result.success;
    const message = result.message || "";

    if (eventType === window.ActivityBridgeHelper?.EventType?.REWARD_AD) {
      clearRewardAdTimeout();
      const taskId = result.taskId || result.task_id || lastRewardAdTaskId;
      logger.log("[活动事件完成] reward_ad taskId=" + taskId + ", success=" + success, {
        adStatusCode: result.adStatusCode,
        adErrorCode: result.adErrorCode,
        adDetail: result.adDetail,
        message,
      });
      if (taskId === "task_watch_ad") {
        if (success) {
          if (business.isDailyAdLimitReached()) {
            showDailyAdLimitToast();
            adapter.trackEvent("daily_video_completed", {
              taskId: "task_watch_ad",
              success: false,
              reason: DAILY_AD_LIMIT_MESSAGE,
              platform: adapter.getPlatform(),
            });
            return;
          }
          if (ui.isWaitingAdForSpin()) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await ui.handleRewardAdCompletedForSpin();
          } else if (!business.isDailyAdLimitReached()) {
            ui.addSpinChance(1);
          }
          adapter.trackEvent("daily_video_completed", {
            taskId: "task_watch_ad",
            success: true,
            platform: adapter.getPlatform(),
          });
        } else {
          const displayMessage = normalizeAdMessage(message, "Ad not completed");
          ui.handleRewardAdFailedForSpin(displayMessage);
          adapter.trackEvent("ad_watch_failed", {
            taskId: "task_watch_ad",
            reason: displayMessage,
            adStatusCode: result.adStatusCode,
            adErrorCode: result.adErrorCode,
            adDetail: result.adDetail,
          });
        }
      }
      return;
    }

    if (eventType === window.ActivityBridgeHelper?.EventType?.INTERSTITIAL_AD) {
      clearInterstitialAdTimeout();
      const taskId = result.taskId || result.task_id || lastInterstitialAdTaskId;
      logger.log("[活动事件完成] interstitial_ad taskId=" + taskId + ", success=" + success, {
        adStatusCode: result.adStatusCode,
        adErrorCode: result.adErrorCode,
        adDetail: result.adDetail,
        message,
      });
      if (taskId === "task_checkin") {
        if (success) {
          const video_id = result.video_id ?? result.videoId ?? result.data?.video_id ?? "";
          logger.log("[活动事件完成] 签到看视频领奖 video_id=" + video_id);
          if (checkinVideoClaimInFlight) return;
          checkinVideoClaimInFlight = true;
          business
            .claimCheckinVideoReward(apiOptions, video_id)
            .then((claimResult) => {
              if (claimResult?.ok) {
                ui.markSigninVideoCompleted();
              }
            })
            .finally(() => {
              checkinVideoClaimInFlight = false;
              checkinWatchAdInFlight = false;
              if (!ui.isSigninVideoCompleted()) {
                ui.setSigninWatchLoading(false);
              }
            });
          adapter.trackEvent("checkin_video_completed", { taskId, success: true });
        } else {
          checkinWatchAdInFlight = false;
          ui.setSigninWatchLoading(false);
          const displayMessage = normalizeAdMessage(message, "Ad not completed");
          ui.showToast(displayMessage, "warning");
          adapter.trackEvent("checkin_video_failed", {
            taskId,
            reason: displayMessage,
            adStatusCode: result.adStatusCode,
            adErrorCode: result.adErrorCode,
            adDetail: result.adDetail,
          });
        }
      }
    }
  }

  ui = new ActivityCenterUI({
    isDailyAdLimitReached: () => business.isDailyAdLimitReached(),
    getDailyAdLimitMessage: () => DAILY_AD_LIMIT_MESSAGE,
    getAdTaskStatus: () => business.getAdTaskStatus(),
    onWatchAdClick: async () => {
      if (business.isDailyAdLimitReached()) {
        showDailyAdLimitToast();
        return;
      }
      try {
        const adTaskStatus = business.getAdTaskStatus();
        lastRewardAdTaskId = "task_watch_ad";
        startRewardAdTimeout();
        await adapter.triggerRewardAd({ taskId: "task_watch_ad", reward: adTaskStatus.reward });
      } catch (error) {
        clearRewardAdTimeout();
        const message = normalizeAdMessage(error?.message, "Ad is not available");
        logger.error("[Ad trigger failed] reward_ad task_watch_ad", error);
        ui.handleRewardAdFailedForSpin(message);
        adapter.trackEvent("ad_watch_error", {
          taskId: "task_watch_ad",
          error: error?.message || String(error),
        });
      }
    },
    onSpinWheelOpen: async () => {
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
      router.push({
        name: "gold-coins-exchange",
        query: activityId ? { activity_id: activityId } : {},
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

      ui.showToast("All check-in tasks completed", "info");
    },
    onSigninWatchVideoClick: async () => {
      if (ui.isSigninVideoCompleted()) {
        ui.showToast("Video check-in already completed today", "info");
        return;
      }
      if (checkinWatchAdInFlight) return;
      try {
        checkinWatchAdInFlight = true;
        ui.setSigninWatchLoading(true);
        lastInterstitialAdTaskId = "task_checkin";
        const today = business.getTodayCheckinDay();
        logger.log("[签到弹框看视频] triggerInterstitialAd", {
          taskId: "task_checkin",
          reward: today?.video_coin,
          hasToday: !!today,
        });
        startInterstitialAdTimeout();
        await adapter.triggerInterstitialAd({ taskId: "task_checkin", reward: today?.video_coin });
      } catch (e) {
        clearInterstitialAdTimeout();
        checkinWatchAdInFlight = false;
        ui.setSigninWatchLoading(false);
        const message = normalizeAdMessage(e?.message, "Video is not available");
        logger.error("[Ad trigger failed] interstitial_ad task_checkin", e);
        ui.showToast(message, "error");
        adapter.trackEvent("checkin_video_error", {
          taskId: "task_checkin",
          error: e?.message || String(e),
        });
      }
    },
  });

  window.onRewardedAdError = function (error) {
    clearRewardAdTimeout();
    logger.error("广告播放错误:", error);
    ui.handleRewardAdFailedForSpin(
      normalizeAdMessage(error?.message, "Ad failed to play, please try again"),
    );
    adapter.trackEvent("ad_watch_error", {
      taskId: "task_watch_ad",
      error: error?.message || String(error),
    });
  };

  ui.bindEvents();
  ui.renderInitialShell();

  const cachedActivityInfo = getActivityInfoCache(token);
  if (cachedActivityInfo) {
    business.applyActivityInfoData(cachedActivityInfo);
  }

  void business.loadActivityInfo(apiOptions);

  adapter.init().catch((error) => {
    logger.error("初始化失败", error);
    ui.showToast("Initialization failed, please try again", "error");
  });

  return function disposeActivityCenter() {
    clearRewardAdTimeout();
    clearInterstitialAdTimeout();
    window.onRewardedAdError = null;
    window.ActivityBridgeHelper?.clearActivityEventCompleted?.();
  };
}
