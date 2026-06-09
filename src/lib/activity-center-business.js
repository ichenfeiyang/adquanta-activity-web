import { getActivityInfo, postCheckin, postActivityVideo } from "./activity-api.js";
import { invalidateActivityInfoCache, loadActivityInfoWithSWR } from "./activity-page-cache.js";
import * as logger from "./activity-logger.js";

export const DAILY_AD_LIMIT_MESSAGE = "Daily ad watch limit reached";

/**
 * 活动中心业务逻辑层
 * 负责：用户资产管理、任务状态管理、业务流程处理
 * 不依赖 DOM，只处理数据和业务逻辑
 */
export class WelfareCenterBusiness {
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

    // 当前用户 ID（来自 user_info.user_id）
    this.userId = null;

    this._lastActivityInfoFingerprint = "";

    // 配置
    this.config = {
      onAssetsUpdate: config.onAssetsUpdate || (() => {}),
      onTaskUpdate: config.onTaskUpdate || (() => {}),
      onCheckinUpdate: config.onCheckinUpdate || (() => {}),
      onFeatureVisibilityUpdate: config.onFeatureVisibilityUpdate || (() => {}),
      onUserInfoUpdate: config.onUserInfoUpdate || (() => {}),
      onToast: config.onToast || (() => {}),
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
   * 获取当前签到任务详情（含 days、continuous_days、super_reward_day）
   */
  getCheckinDetail() {
    return this.checkinDetail ? { ...this.checkinDetail } : null;
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

  resolveDailyAdMessage(message, fallback = "Ad failed to play, please try again") {
    if (this.isDailyAdLimitReached() || this.isDailyAdLimitErrorMessage(message)) {
      return DAILY_AD_LIMIT_MESSAGE;
    }
    const text = String(message || "").trim();
    return text || fallback;
  }

  buildActivityInfoFingerprint(d) {
    const tasks = Array.isArray(d?.tasks) ? d.tasks : [];
    const checkin = tasks.find((task) => task.type === "checkin")?.detail ?? null;
    const video = tasks.find((task) => task.type === "video")?.detail ?? null;
    return JSON.stringify({
      coin: d?.wallet_info?.coin ?? null,
      userId: d?.user_info?.user_id ?? null,
      checkin,
      video,
    });
  }

  applyActivityInfoData(d) {
    const fingerprint = this.buildActivityInfoFingerprint(d);
    if (fingerprint === this._lastActivityInfoFingerprint) {
      return;
    }
    this._lastActivityInfoFingerprint = fingerprint;

    let hasCheckinTask = false;
    let hasVideoTask = false;

    this.checkinDetail = null;
    this.adTaskStatus = this.createEmptyAdTaskStatus();

    if (d.user_info != null && d.user_info.user_id != null) {
      this.userId = d.user_info.user_id;
      this.config.onUserInfoUpdate({ user_id: this.userId });
    }
    if (d.wallet_info != null && typeof d.wallet_info.coin === "number") {
      this.userAssets.goldCoins = d.wallet_info.coin;
      this.config.onAssetsUpdate(this.userAssets);
    }

    const tasks = Array.isArray(d.tasks) ? d.tasks : [];
    for (const task of tasks) {
      if (task.type === "checkin" && task.detail != null) {
        hasCheckinTask = true;
        this.checkinDetail = task.detail;
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
    if (!hasVideoTask) {
      this.config.onTaskUpdate({ watchAd: null });
    }
    this.config.onFeatureVisibilityUpdate({
      checkin: hasCheckinTask,
      video: hasVideoTask,
    });
    logger.log("[Activity API] Using response data\n", {
      user_id: this.userId,
      goldCoins: this.userAssets.goldCoins,
      checkin: hasCheckinTask,
      watchAd: hasVideoTask ? this.adTaskStatus : null,
    });
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
      if (force) {
        invalidateActivityInfoCache(token);
      }

      const result = await loadActivityInfoWithSWR(token, {
        force,
        fetcher: () => getActivityInfo(apiOptions),
        onData: (data) => this.applyActivityInfoData(data),
      });

      if (result.ok && result.data) {
        return { ok: true, data: result.data, fromCache: !!result.fromCache };
      }

      logger.warn("[Activity API] Unexpected response while loading activity info");
      throw result.error || new Error("API returned an error");
    } catch (error) {
      logger.error("[Activity API] Request failed", error?.message ?? error);
      this.config.onToast("Failed to load activity data, please try again", "warning");
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
        this.config.onToast(res.message || "Check-in failed", "error");
        return { ok: false };
      }
      const coinFromCheckin = res.data?.coin ?? res.coin ?? 0;
      await this.loadActivityInfo(apiOptions, { force: true });
      const today = this.getTodayCheckinDay();
      const video_coin = today?.video_coin ?? 0;
      const multiplier = (today?.coin > 0) ? Math.floor((today.video_coin ?? 0) / today.coin) : 0;
      return { ok: true, coinFromCheckin, video_coin, multiplier };
    } catch (error) {
      logger.error("Do checkin failed", error);
      this.config.onToast(error?.message || "Check-in failed, please try again", "error");
      return { ok: false };
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
        this.config.onToast("Video check-in successful", "success");
      } else {
        this.config.onToast(msg || "Claim failed", "error");
      }
    } catch (error) {
      logger.error("Claim checkin video reward failed", error);
      this.config.onToast(error?.message || "Claim failed, please try again", "error");
    }
    // Refresh only after successful reward claim.
    if (success) {
      await this.loadActivityInfo(apiOptions, { force: true });
    }
    return { ok: success };
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
          this.config.onToast("No coins received", "error");
          return { ok: false };
        }
        return {
          ok: true,
          coin: rewardCoin,
          roulette: res.data?.roulette ?? null,
          message: msg || "Video completed! Coins rewarded.",
        };
      } else {
        this.config.onToast(this.resolveDailyAdMessage(msg, "Claim failed"), "error");
      }
    } catch (error) {
      logger.error("Turntable / daily video reward failed", error);
      this.config.onToast(
        this.resolveDailyAdMessage(error?.message, "Claim failed, please try again"),
        "error",
      );
    }
    return { ok: false };
  }

  /**
   * 获取用户资产
   */
  getUserAssets() {
    return { ...this.userAssets };
  }

  /**
   * 获取广告任务状态
   */
  getAdTaskStatus() {
    return { ...this.adTaskStatus };
  }
}
