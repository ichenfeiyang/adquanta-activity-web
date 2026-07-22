import {
  getActivityInfo,
  postActivityVideo,
  postCheckin,
  postCheckinChest,
  postCoinRain,
  postNewUserBonus,
} from "./activity-api.js";
import { invalidateActivityInfoCache, loadActivityInfoWithSWR } from "./activity-page-cache.js";
import { showToast } from "./activity-alert-ui.js";
import {
  activityLoadFailedMessage,
  adFailedMessage,
  checkinFailedMessage,
  checkinFailedRetryMessage,
  claimFailedMessage,
  claimFailedRetryMessage,
  dailyAdLimitMessage,
  noCoinsReceivedMessage,
  videoCheckinSuccessMessage,
  videoCompletedRewardMessage,
} from "./activity-messages.js";
import * as logger from "./activity-logger.js";
import { normalizeCheckinChests } from "./checkin-chest.js";
import { normalizeRecentRedemptions } from "./recent-redemptions.js";
import { normalizeCoinRain } from "./coin-rain.js";

export { normalizeCheckinChests } from "./checkin-chest.js";

export function getDailyAdLimitMessage() {
  return dailyAdLimitMessage();
}

function normalizeActivityTasks(data) {
  const raw = data?.tasks;
  return Array.isArray(raw) ? raw : [];
}

function normalizeWalletCoin(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const CHECKIN_CHEST_QUEUE_KEY = "activity_checkin_chest_queue_v1";

function readCheckinChestQueue() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CHECKIN_CHEST_QUEUE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCheckinChestQueue(queue) {
  try { sessionStorage.setItem(CHECKIN_CHEST_QUEUE_KEY, JSON.stringify(queue)); } catch { /* unavailable storage */ }
}

/**
 * 活动中心业务逻辑层
 * 负责：用户资产管理、任务状态管理、业务流程处理
 * 不依赖 DOM，只处理数据和业务逻辑
 */
export class ActivityCenterBusiness {
  constructor(config = {}) {
    // 用户资产（未获取到服务端数据前缺省 0）
    this.userAssets = {
      goldCoins: 0,
    };

    // 广告任务状态（未获取到服务端数据前缺省 0）
    this.adTaskStatus = {
      completed: 0,
      daily_limit: 0,
      reward: 0,
      remain_count: 0,
      roulette: null,
    };

    // 签到任务详情（来自 tasks[] 中 type === 'checkin' 的 task.detail）
    this.checkinDetail = null;
    this.checkinChests = [];

    // 当前用户 ID（来自 user_info.user_id）
    this.userId = null;

    this.newUserBonus = null;
    this.redeemGap = null;
    this.redeemRewards = null;
    this.recentRedemptions = [];
    this.coinRain = null;

    this._lastActivityInfoFingerprint = "";

    // 配置
    this.config = {
      onAssetsUpdate: config.onAssetsUpdate || (() => {}),
      onTaskUpdate: config.onTaskUpdate || (() => {}),
      onCheckinUpdate: config.onCheckinUpdate || (() => {}),
      onCheckinChestUpdate: config.onCheckinChestUpdate || (() => {}),
      onCheckinPromptUpdate: config.onCheckinPromptUpdate || (() => {}),
      onFeatureVisibilityUpdate: config.onFeatureVisibilityUpdate || (() => {}),
      onRedeemGapUpdate: config.onRedeemGapUpdate || (() => {}),
      onRedeemRewardsUpdate: config.onRedeemRewardsUpdate || (() => {}),
      onRecentRedemptionsUpdate: config.onRecentRedemptionsUpdate || (() => {}),
      onCoinRainUpdate: config.onCoinRainUpdate || (() => {}),
      ...config,
    };
  }

  createEmptyAdTaskStatus() {
    return {
      completed: 0,
      daily_limit: 0,
      reward: 0,
      remain_count: 0,
      roulette: null,
    };
  }

  /**
   * 获取今日签到项（detail.days 中 current === true 的那一项）
   */
  getTodayCheckinDay() {
    if (!this.checkinDetail || !Array.isArray(this.checkinDetail.days)) return null;
    return this.checkinDetail.days.find((d) => d.current === true) || null;
  }

  isDailyAdLimitReached() {
    const dailyLimit = Number(this.adTaskStatus.daily_limit ?? 0);
    if (dailyLimit <= 0) return false;
    const remain = Number(this.adTaskStatus.remain_count ?? 0);
    const completed = Number(this.adTaskStatus.completed ?? 0);
    return remain <= 0 || completed >= dailyLimit;
  }

  isDailyAdLimitErrorMessage(message) {
    const text = String(message || "").toLowerCase();
    if (!text) return false;
    return (
      text.includes("limit") ||
      text.includes("上限") ||
      text.includes("次数") ||
      text.includes("已达") ||
      text.includes("maximum") ||
      text.includes("reached")
    );
  }

  resolveDailyAdMessage(message, fallback = adFailedMessage()) {
    if (this.isDailyAdLimitReached() || this.isDailyAdLimitErrorMessage(message)) {
      return dailyAdLimitMessage();
    }
    const text = String(message || "").trim();
    return text || fallback;
  }

  buildActivityInfoFingerprint(d) {
    const tasks = normalizeActivityTasks(d);
    const checkin = tasks.find((task) => task.type === "checkin")?.detail ?? null;
    const video = tasks.find((task) => task.type === "video")?.detail ?? null;
    return JSON.stringify({
      coin: normalizeWalletCoin(d?.wallet_info?.coin),
      userId: d?.user_info?.user_id ?? null,
      checkin,
      video,
      newUserBonus: d?.new_user_bonus ?? null,
      redeemGap: d?.redeem_gap ?? null,
      redeemRewards: d?.redeem_rewards ?? null,
      recentRedemptions: d?.recent_redemptions ?? [],
      coinRain: d?.coin_rain ?? null,
    });
  }

  normalizeNewUserBonus(value) {
    if (!value || typeof value !== "object") return null;
    return {
      eligible: value.eligible === true,
      show: value.show === true,
      base_coin: Number(value.base_coin ?? 0) || 0,
      video_coin: Number(value.video_coin ?? 0) || 0,
      status: String(value.status || ""),
    };
  }

  normalizeRedeemGap(value) {
    if (!value || typeof value !== "object" || value.enabled !== true) return null;
    const minCoin = Number(value.min_coin ?? 0) || 0;
    const remainingCoin = Number(value.remaining_coin ?? 0) || 0;
    if (minCoin <= 0) return null;
    return {
      enabled: true,
      min_coin: minCoin,
      remaining_coin: Math.max(0, remainingCoin),
      can_redeem: value.can_redeem === true,
      message: String(value.message || ""),
    };
  }

  normalizeRedeemRewards(value, hasRedeemRewardsField = true) {
    if (!hasRedeemRewardsField) return { fallback: true };
    if (!value || typeof value !== "object" || value.enabled !== true) return null;
    const items = Array.isArray(value.items) ? value.items : [];
    const normalizedItems = items
      .map((item) => {
        const minCoin = Number(item?.min_coin ?? 0) || 0;
        if (minCoin <= 0) return null;
        const remainingCoin = Number(item?.remaining_coin ?? 0) || 0;
        return {
          type: String(item?.type || ""),
          title: String(item?.title || ""),
          min_coin: minCoin,
          remaining_coin: Math.max(0, remainingCoin),
          can_redeem: item?.can_redeem === true,
        };
      })
      .filter(Boolean);
    if (!normalizedItems.length) return null;
    return {
      enabled: true,
      items: normalizedItems,
    };
  }

  normalizeCoinRain(value) {
    return normalizeCoinRain(value);
  }

  applyActivityInfoData(d, { fromCache = false } = {}) {
    const fingerprint = this.buildActivityInfoFingerprint(d);
    if (fingerprint === this._lastActivityInfoFingerprint) {
      // Cached content is intentionally not allowed to trigger the prompt, but
      // the fresh response still needs to do so even when task data is unchanged.
      if (!fromCache) {
        this.config.onCheckinPromptUpdate?.(d?.checkin_prompt, this.checkinDetail, { fromCache: false });
      }
      return;
    }

    let hasCheckinTask = false;
    let hasVideoTask = false;
    let applied = false;

    this.checkinDetail = null;
    this.checkinChests = [];
    this.adTaskStatus = this.createEmptyAdTaskStatus();
    this.newUserBonus = this.normalizeNewUserBonus(d?.new_user_bonus);
    this.redeemGap = this.normalizeRedeemGap(d?.redeem_gap);
    this.redeemRewards = this.normalizeRedeemRewards(
      d?.redeem_rewards,
      Object.prototype.hasOwnProperty.call(d || {}, "redeem_rewards"),
    );
    this.recentRedemptions = normalizeRecentRedemptions(d?.recent_redemptions);
    this.coinRain = this.normalizeCoinRain(d?.coin_rain);

    try {
      if (d.user_info != null && d.user_info.user_id != null) {
        this.userId = d.user_info.user_id;
      }
      const coin = normalizeWalletCoin(d?.wallet_info?.coin);
      if (coin != null) {
        this.userAssets.goldCoins = coin;
        this.config.onAssetsUpdate(this.userAssets);
      }

      const tasks = normalizeActivityTasks(d);
      for (const task of tasks) {
        if (task.type === "checkin" && task.detail != null) {
          hasCheckinTask = true;
          this.checkinDetail = task.detail;
          this.checkinChests = normalizeCheckinChests(task.detail?.chests);
          this.config.onCheckinUpdate(task.detail);
        }
        if (task.type === "video" && task.detail != null) {
          hasVideoTask = true;
          const v = task.detail;
          const dailyLimit = v.daily_limit ?? 0;
          const todayWatched = v.today_watched ?? 0;
          const remain =
            typeof v.remain_count === "number"
              ? v.remain_count
              : Math.max(0, dailyLimit - todayWatched);
          const roulette =
            v.roulette != null && typeof v.roulette === "object" ? { ...v.roulette } : null;
          this.adTaskStatus = {
            completed: todayWatched,
            daily_limit: dailyLimit,
            reward: v.coin ?? 0,
            remain_count: remain,
            roulette,
          };
          this.config.onTaskUpdate({ watchAd: this.adTaskStatus });
        }
      }
      if (!hasCheckinTask) {
        this.config.onCheckinUpdate(null);
      }
      this.config.onCheckinChestUpdate(this.checkinChests[0] || null);
      if (!hasVideoTask) {
        this.config.onTaskUpdate({ watchAd: null });
      }
      applied = true;
      logger.log("[Activity API] Using response data\n", {
        user_id: this.userId,
        goldCoins: this.userAssets.goldCoins,
        checkin: hasCheckinTask,
        watchAd: hasVideoTask ? this.adTaskStatus : null,
        newUserBonus: this.newUserBonus,
        redeemGap: this.redeemGap,
        redeemRewards: this.redeemRewards,
        recentRedemptions: this.recentRedemptions,
        coinRain: this.coinRain,
      });
    } catch (error) {
      logger.error("[Activity API] Failed to apply activity info UI", error);
    } finally {
      this.config.onFeatureVisibilityUpdate({
        checkin: hasCheckinTask,
        video: hasVideoTask,
      });
      if (applied) {
        this.config.onNewUserBonusUpdate?.(this.newUserBonus);
        this.config.onRedeemGapUpdate?.(this.redeemGap);
        this.config.onRedeemRewardsUpdate?.(this.redeemRewards);
        this.config.onRecentRedemptionsUpdate?.(this.recentRedemptions);
        this.config.onCoinRainUpdate?.(this.coinRain);
        this.config.onCheckinPromptUpdate?.(d?.checkin_prompt, this.checkinDetail, { fromCache });
        this._lastActivityInfoFingerprint = fingerprint;
      }
    }
  }

  /**
   * 加载活动基础数据（后端接口 /api/v1/ops/activity/info）
   * 成功则用接口数据更新资产与任务；失败则返回错误
   * @param {Object} [apiOptions] - { baseUrl?, token? }
   * @param {{ force?: boolean }} [options] - force=true 跳过缓存直接请求
   */
  async loadActivityInfo(apiOptions = {}, options = {}) {
    const { force = false } = options;
    const token = apiOptions.token || "";

    try {
      await this.flushCheckinChestQueue(apiOptions);
      if (force) {
        invalidateActivityInfoCache(token);
      }

      const result = await loadActivityInfoWithSWR(token, {
        force,
        fetcher: () => getActivityInfo(apiOptions),
        onData: (data, metadata) => this.applyActivityInfoData(data, metadata),
      });

      if (result.ok && result.data) {
        return { ok: true, data: result.data, fromCache: !!result.fromCache };
      }

      logger.warn("[Activity API] Unexpected response while loading activity info");
      throw result.error || new Error("API returned an error");
    } catch (error) {
      logger.error("[Activity API] Request failed", error?.message ?? error);
      this.config.onRedeemRewardsUpdate?.({ fallback: true });
      showToast(activityLoadFailedMessage(), "warning");
      return { ok: false, error };
    }
  }

  /**
   * 执行签到（调用后端 /api/v1/ops/activity/checkin），成功后刷新 activity info，返回弹框三处数据：coinFromCheckin、video_coin、multiplier
   * @param {Object} [apiOptions] - { baseUrl?, token? }
   * @returns {Promise<{ ok: boolean, coinFromCheckin?: number, video_coin?: number, multiplier?: number }>}
   */
  async doCheckin(apiOptions = {}) {
    try {
      const res = await postCheckin(apiOptions, { type: "base" });
      if (res.code !== 200) {
        showToast(res.message || checkinFailedMessage(), "error");
        return { ok: false, message: res.message || checkinFailedMessage() };
      }
      const coinFromCheckin = res.data?.coin ?? res.coin ?? 0;
      const chest = normalizeCheckinChests(res.data?.chest ? [res.data.chest] : [])[0] || null;
      if (chest) {
        this.checkinChests = [chest];
        this.config.onCheckinChestUpdate(chest);
      }
      await this.loadActivityInfo(apiOptions, { force: true });
      const today = this.getTodayCheckinDay();
      const video_coin = today?.video_coin ?? 0;
      const multiplier = (today?.coin > 0) ? Math.floor((today.video_coin ?? 0) / today.coin) : 0;
      return { ok: true, coinFromCheckin, video_coin, multiplier, chest };
    } catch (error) {
      logger.error("Do checkin failed", error);
      showToast(error?.message || checkinFailedRetryMessage(), "error");
      return { ok: false, message: error?.message || checkinFailedRetryMessage() };
    }
  }

  /**
   * 签到看视频成功领取奖励：调用 /api/v1/ops/activity/checkin(type=triple)，然后 tip message，再刷新基础信息
   * @param {Object} [apiOptions] - { baseUrl?, token? }
   * @param {string} [video_id] - 看完视频后得到的视频 id（来自 SDK 回调）
   * @returns {Promise<{ ok: boolean }>}
   */
  async claimCheckinVideoReward(apiOptions = {}, video_id = "") {
    logger.log("[Check-in video reward] Call /api/v1/ops/activity/checkin type=triple, video_id=" + video_id);
    let success = false;
    try {
      const res = await postCheckin(apiOptions, { type: "triple" });
      const msg = res.data?.message ?? res.message ?? "";
      if (res.code === 200) {
        success = true;
        const chest = normalizeCheckinChests(res.data?.chest ? [res.data.chest] : [])[0] || null;
        if (chest) {
          this.checkinChests = [chest];
          this.config.onCheckinChestUpdate(chest);
        }
        showToast(videoCheckinSuccessMessage(), "success");
      } else {
        showToast(msg || claimFailedMessage(), "error");
      }
    } catch (error) {
      logger.error("Claim checkin video reward failed", error);
      showToast(error?.message || claimFailedRetryMessage(), "error");
    }
    // Refresh only after successful reward claim.
    if (success) {
      await this.loadActivityInfo(apiOptions, { force: true });
    }
    return { ok: success };
  }

  queueCheckinChestAction(action, chestId, adEventId = "") {
    // Soft-close no longer uses dismiss; only claim needs offline replay.
    if (action !== "claim") return;
    const item = { chest_id: Number(chestId), action: "claim", ad_event_id: String(adEventId || "") };
    if (!item.chest_id) return;
    const queue = readCheckinChestQueue().filter((entry) => entry.chest_id !== item.chest_id);
    queue.push(item);
    writeCheckinChestQueue(queue);
  }

  async flushCheckinChestQueue(apiOptions = {}) {
    const queue = readCheckinChestQueue();
    if (!queue.length) return;
    // Drop legacy dismiss entries so soft-close chests stay reopenable.
    const claims = queue.filter((item) => item?.action === "claim");
    const remaining = [];
    for (const item of claims) {
      try {
        const res = await postCheckinChest(apiOptions, item);
        if (res?.code !== 200) remaining.push(item);
      } catch {
        remaining.push(item);
      }
    }
    writeCheckinChestQueue(remaining);
  }

  async submitCheckinChestAction(apiOptions = {}, action, chestId, adEventId = "") {
    try {
      const res = await postCheckinChest(apiOptions, { chest_id: chestId, action, ad_event_id: adEventId });
      const ok = res?.code === 200 && res?.data?.success !== false;
      if (!ok) return { ok: false, message: res?.data?.message || res?.message || claimFailedMessage() };
      this.checkinChests = this.checkinChests.filter((chest) => chest.id !== Number(chestId));
      this.config.onCheckinChestUpdate(this.checkinChests[0] || null);
      await this.loadActivityInfo(apiOptions, { force: true });
      return { ok: true, coin: Number(res?.data?.coin ?? 0) || 0, totalCoin: Number(res?.data?.total_coin ?? 0) || 0 };
    } catch (error) {
      if (action === "claim") this.queueCheckinChestAction(action, chestId, adEventId);
      logger.warn("Check-in chest action queued for retry", { action, chestId, message: error?.message });
      return { ok: false, queued: action === "claim" };
    }
  }

  /**
   * 日常看视频后转动转盘结算：广告看完后调用 /api/v1/ops/activity/video，再刷新基础信息
   * @param {Object} [apiOptions] - { baseUrl?, token? }
   * @param {string} [video_id]
   * @returns {Promise<{ ok: boolean }>}
   */
  async claimDailyVideoReward(apiOptions = {}, video_id = "") {
    logger.log("[Spin settlement] Call /api/v1/ops/activity/video video_id=" + video_id);
    try {
      const res = await postActivityVideo(apiOptions, { video_id });
      const msg = res.data?.message ?? res.message ?? "";
      if (res.code === 200 && res.data?.success) {
        const coinValue = res.data?.coin;
        const rewardCoin = Number(coinValue);
        if (coinValue == null || coinValue === "" || !Number.isFinite(rewardCoin)) {
          showToast(noCoinsReceivedMessage(), "error");
          return { ok: false };
        }
        return {
          ok: true,
          coin: rewardCoin,
          roulette: res.data?.roulette ?? null,
          message: msg || videoCompletedRewardMessage(),
        };
      } else {
        showToast(this.resolveDailyAdMessage(msg, claimFailedMessage()), "error");
      }
    } catch (error) {
      logger.error("Turntable / daily video reward failed", error);
      showToast(
        this.resolveDailyAdMessage(error?.message, claimFailedRetryMessage()),
        "error",
      );
    }
    return { ok: false };
  }

  async submitNewUserBonusAction(apiOptions = {}, action, adEventId = "") {
    try {
      const res = await postNewUserBonus(apiOptions, {
        action,
        ad_event_id: adEventId,
      });
      const ok = res?.code === 200 && res?.data?.success !== false;
      if (!ok) {
        showToast(res?.data?.message || res?.message || claimFailedMessage(), "error");
        return { ok: false };
      }

      await this.loadActivityInfo(apiOptions, { force: true });
      return {
        ok: true,
        coin: Number(res?.data?.coin ?? res?.data?.reward_coin ?? 0) || 0,
        message: res?.data?.message || res?.message || "",
      };
    } catch (error) {
      logger.error("New user bonus action failed", error);
      showToast(error?.message || claimFailedRetryMessage(), "error");
      return { ok: false };
    }
  }

  async submitCoinRainAction(apiOptions = {}, action, payload = {}) {
    try {
      const res = await postCoinRain(apiOptions, { action, ...payload });
      if (res?.code !== 200 || res?.data?.success === false) {
        return { ok: false, message: res?.data?.message || res?.message || claimFailedMessage() };
      }
      this.coinRain = this.normalizeCoinRain(res.data);
      this.config.onCoinRainUpdate?.(this.coinRain);
      const totalCoin = Number(res?.data?.total_coin);
      if ((action === "settle" || action === "boost") && Number.isFinite(totalCoin) && totalCoin >= 0) {
        this.userAssets.goldCoins = totalCoin;
        this.config.onAssetsUpdate(this.userAssets);
      }
      invalidateActivityInfoCache(apiOptions.token || "");
      return { ok: true, ...res.data };
    } catch (error) {
      logger.error("Coin rain action failed", error);
      return { ok: false, message: error?.message || claimFailedRetryMessage() };
    }
  }

  /**
   * 获取广告任务状态
   */
  getAdTaskStatus() {
    return { ...this.adTaskStatus };
  }

  getUserId() {
    return this.userId;
  }
}
