import { adNotCompletedMessage, dailyAdLimitMessage } from "./activity-messages.js";
import { ACTIVITY_CENTER_PAGE_ID } from "./activity-analytics.js";
import { showToast } from "./activity-alert-ui.js";
import * as logger from "./activity-logger.js";

/**
 * @param {{
 *   business: import("./activity-center-business.js").ActivityCenterBusiness,
 *   ui: import("./activity-center-ui.js").ActivityCenterUI,
 *   adapter: import("./activity-center-adapter.js").ActivityCenterAdapter,
 *   normalizeAdMessage: (message: string, fallback?: string) => string,
 *   showDailyAdLimitToast: () => void,
 *   checkinVideoClaimInFlight: { value: boolean },
 *   checkinWatchAdInFlight: { value: boolean },
 *   newUserBonusAdInFlight: { value: boolean },
 *   newUserBonusClaimInFlight: { value: boolean },
 *   checkinChestAdInFlight: { value: boolean },
 *   checkinChestClaimInFlight: { value: boolean },
 *   onCheckinVideoRewardClaimed: () => void,
 * }} ctx
 */
async function handleRewardAdEvent(ctx, result) {
  const {
    business,
    ui,
    adapter,
    apiOptions,
    getLastRewardAdTaskId,
    rewardAdTimeout,
    normalizeAdMessage,
    showDailyAdLimitToast,
    newUserBonusAdInFlight,
    newUserBonusClaimInFlight,
    checkinChestAdInFlight,
    checkinChestClaimInFlight,
    getCheckinChest,
    checkinChestAdTimeout,
    coinRainAdInFlight,
    coinRainAdTimeout,
  } = ctx;

  const success = result.success;
  const message = result.message || "";
  const taskId = result.taskId || result.task_id || getLastRewardAdTaskId();

  logger.log("[活动事件完成] reward_ad taskId=" + taskId + ", success=" + success, {
    adStatusCode: result.adStatusCode,
    adErrorCode: result.adErrorCode,
    adDetail: result.adDetail,
    message,
  });

  if (taskId === "task_coin_rain") {
    coinRainAdTimeout?.clear();
    coinRainAdInFlight.value = false;
    if (!success) {
      ui.setCoinRainAdLoading(false);
      const displayMessage = normalizeAdMessage(message, adNotCompletedMessage());
      showToast(displayMessage, "warning");
      adapter.trackEvent("coin_rain_ad_failed", {
        page_id: ACTIVITY_CENTER_PAGE_ID,
        task_id: taskId,
        reason: displayMessage,
        ad_status_code: result.adStatusCode,
        ad_error_code: result.adErrorCode,
      });
      return;
    }
    const adEventId = result.ad_event_id ?? result.adEventId ?? result.video_id ?? result.videoId ?? result.data?.ad_event_id ?? "";
    const status = business.coinRain;
    const boostResult = await business.submitCoinRainAction(apiOptions, "boost", { session_id: status?.session_id, ad_event_id: adEventId });
    if (boostResult?.ok) ui.showCoinRainBoostSuccess(boostResult);
    else {
      ui.setCoinRainAdLoading(false);
      showToast(boostResult?.message || adNotCompletedMessage(), "error");
    }
    adapter.trackEvent("coin_rain_ad_completed", {
      page_id: ACTIVITY_CENTER_PAGE_ID,
      task_id: taskId,
      success: !!boostResult?.ok,
      base_coin: Number(boostResult?.base_coin ?? status?.base_coin ?? 0),
      boost_coin: Number(boostResult?.boost_coin ?? 0),
    });
    return;
  }

  if (taskId === "task_new_user_bonus") {
    newUserBonusAdInFlight.value = false;

    if (success) {
      if (newUserBonusClaimInFlight.value) return;
      newUserBonusClaimInFlight.value = true;
      const adEventId =
        result.ad_event_id ??
        result.adEventId ??
        result.video_id ??
        result.videoId ??
        result.data?.ad_event_id ??
        result.data?.video_id ??
        "";
      const claimResult = await business.submitNewUserBonusAction(
        apiOptions,
        "claim_video",
        adEventId,
      );
      newUserBonusClaimInFlight.value = false;
      if (claimResult?.ok) {
        ui.hideNewUserBonusDialog();
      } else {
        // Keep the dialog actionable: the user can retry or choose to dismiss it.
      }
      adapter.trackEvent("new_user_bonus_video_completed", {
        taskId,
        success: !!claimResult?.ok,
        platform: adapter.getPlatform(),
      });
      return;
    }

    const displayMessage = normalizeAdMessage(message, adNotCompletedMessage());
    showToast(displayMessage, "warning");
    adapter.trackEvent("new_user_bonus_video_failed", {
      taskId,
      reason: displayMessage,
      adStatusCode: result.adStatusCode,
      adErrorCode: result.adErrorCode,
      adDetail: result.adDetail,
    });
    return;
  }

  if (taskId === "task_checkin_chest") {
    checkinChestAdTimeout?.clear();
    checkinChestAdInFlight.value = false;
    const chest = getCheckinChest?.();
    if (!success || !chest?.id) {
      ui.setCheckinChestLoading(false);
      const displayMessage = normalizeAdMessage(message, adNotCompletedMessage());
      if (!success) showToast(displayMessage, "warning");
      adapter.trackEvent("checkin_chest_ad_failed", {
        page_id: ACTIVITY_CENTER_PAGE_ID,
        task_id: taskId,
        chest_id: chest?.id,
        reason: !success ? displayMessage : "missing_chest",
      });
      return;
    }
    if (checkinChestClaimInFlight.value) return;
    checkinChestClaimInFlight.value = true;
    const adEventId = result.ad_event_id ?? result.adEventId ?? result.video_id ?? result.videoId ?? result.data?.ad_event_id ?? "";
    const claimResult = await business.submitCheckinChestAction(apiOptions, "claim", chest.id, adEventId);
    checkinChestClaimInFlight.value = false;
    ui.setCheckinChestLoading(false);
    if (claimResult?.ok) {
      ui.hideCheckinChestDialog();
      ui.showCheckinChestRewardDialog(claimResult.coin);
      adapter.trackEvent("checkin_chest_reward_granted", {
        page_id: ACTIVITY_CENTER_PAGE_ID,
        task_id: taskId,
        chest_id: chest.id,
        coin: claimResult.coin,
      });
    } else if (claimResult?.queued) {
      ui.hideCheckinChestDialog();
      adapter.trackEvent("checkin_chest_reward_queued", {
        page_id: ACTIVITY_CENTER_PAGE_ID,
        task_id: taskId,
        chest_id: chest.id,
      });
    } else {
      showToast(claimResult?.message || adNotCompletedMessage(), "error");
      adapter.trackEvent("checkin_chest_claim_failed", {
        page_id: ACTIVITY_CENTER_PAGE_ID,
        task_id: taskId,
        chest_id: chest.id,
        reason: claimResult?.message || "claim_failed",
      });
    }
    return;
  }

  rewardAdTimeout?.clear();

  if (taskId !== "task_watch_ad") return;

  if (success) {
    if (business.isDailyAdLimitReached()) {
      showDailyAdLimitToast();
      adapter.trackEvent("daily_video_completed", {
        taskId: "task_watch_ad",
        success: false,
        reason: dailyAdLimitMessage(),
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
    return;
  }

  const displayMessage = normalizeAdMessage(message, adNotCompletedMessage());
  ui.handleRewardAdFailedForSpin(displayMessage);
  adapter.trackEvent("ad_watch_failed", {
    taskId: "task_watch_ad",
    reason: displayMessage,
    adStatusCode: result.adStatusCode,
    adErrorCode: result.adErrorCode,
    adDetail: result.adDetail,
  });
}

/**
 * @param {Parameters<typeof handleRewardAdEvent>[0]} ctx
 */
async function handleInterstitialAdEvent(ctx, result) {
  const {
    business,
    ui,
    adapter,
    apiOptions,
    getLastInterstitialAdTaskId,
    interstitialAdTimeout,
    normalizeAdMessage,
    checkinVideoClaimInFlight,
    checkinWatchAdInFlight,
    onCheckinVideoRewardClaimed,
  } = ctx;

  interstitialAdTimeout?.clear();

  const success = result.success;
  const message = result.message || "";
  const taskId = result.taskId || result.task_id || getLastInterstitialAdTaskId();

  logger.log("[活动事件完成] interstitial_ad taskId=" + taskId + ", success=" + success, {
    adStatusCode: result.adStatusCode,
    adErrorCode: result.adErrorCode,
    adDetail: result.adDetail,
    message,
  });

  if (taskId !== "task_checkin") return;

  if (success) {
    const video_id = result.video_id ?? result.videoId ?? result.data?.video_id ?? "";
    logger.log("[活动事件完成] 签到看视频领奖 video_id=" + video_id);
    if (checkinVideoClaimInFlight.value) return;
    checkinVideoClaimInFlight.value = true;
    business
      .claimCheckinVideoReward(apiOptions, video_id)
      .then((claimResult) => {
        if (claimResult?.ok) {
          ui.markSigninVideoCompleted();
          onCheckinVideoRewardClaimed?.();
        }
        adapter.trackEvent("checkin_video_completed", {
          page_id: ACTIVITY_CENTER_PAGE_ID,
          task_id: taskId,
          success: !!claimResult?.ok,
        });
      })
      .finally(() => {
        checkinVideoClaimInFlight.value = false;
        checkinWatchAdInFlight.value = false;
        if (!ui.isSigninVideoCompleted()) {
          ui.setSigninWatchLoading(false);
        }
      });
    return;
  }

  checkinWatchAdInFlight.value = false;
  ui.setSigninWatchLoading(false);
  const displayMessage = normalizeAdMessage(message, adNotCompletedMessage());
  showToast(displayMessage, "warning");
  adapter.trackEvent("checkin_video_failed", {
    page_id: ACTIVITY_CENTER_PAGE_ID,
    task_id: taskId,
    reason: displayMessage,
    ad_status_code: result.adStatusCode,
    ad_error_code: result.adErrorCode,
    ad_detail: result.adDetail,
  });
}

/**
 * @param {Parameters<typeof handleRewardAdEvent>[0]} ctx
 */
export function createActivitySdkEventHandler(ctx) {
  return async function handleSDKEventCompleted(result) {
    logger.log("活动事件完成回调:", result);

    if (!result || !result.eventType) {
      logger.warn("事件完成回调数据格式错误:", result);
      return;
    }

    const eventType = result.eventType;
    const RewardAd = window.ActivityBridgeHelper?.EventType?.REWARD_AD;
    const InterstitialAd = window.ActivityBridgeHelper?.EventType?.INTERSTITIAL_AD;

    if (eventType === RewardAd) {
      await handleRewardAdEvent(ctx, result);
      return;
    }

    if (eventType === InterstitialAd) {
      await handleInterstitialAdEvent(ctx, result);
    }
  };
}
