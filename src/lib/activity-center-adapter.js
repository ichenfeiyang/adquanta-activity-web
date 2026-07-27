/**
 * H5-SDK 适配器层
 * 负责：H5 页面与 SDK 之间的协商和桥接
 * 包括：SDK 初始化、事件处理、回调注册
 */
import * as logger from "./activity-logger.js";

function isBridgeReady() {
  return !!(window.ActivityBridgeHelper?.isAvailable?.());
}

export class ActivityCenterAdapter {
  constructor(config = {}) {
    this.config = {
      activityId: config.activityId || "",
      code: config.code || "",
      token: config.token || "",
      channelTag: config.channelTag || "",
      getUserId: config.getUserId || (() => null),
      onSDKReady: config.onSDKReady || (() => {}),
      onEventCompleted: config.onEventCompleted || (() => {}),
      ...config,
    };

    this.sdk = null;
    this.isSDKReady = false;
    this.eventCompletedCallback = (result) => {
      this.config.onEventCompleted(result);
    };
  }

  /**
   * 初始化 SDK（等待原生注入）
   */
  async init() {
    // 等待原生 SDK 注入
    await this.waitForSDK();

    // SDK 就绪后确保事件回调已注册。
    this.setupEventCallback();

    // 初始化活动会话
    if (window.ActivityBridgeHelper && window.ActivityBridgeHelper.initActivity) {
      try {
        const session = await window.ActivityBridgeHelper.initActivity(
          this.config.activityId,
          this.config.code,
          this.config.token,
          this.config.channelTag
        );
        logger.log("SDK init succeeded:", session);

        // 追踪页面浏览事件
        await window.ActivityBridgeHelper.trackEvent(
          "page_view",
          this.buildTrackEventPayload({
            url: `${window.location.origin}${window.location.pathname}`,
          }),
        );

        this.isSDKReady = true;
        this.config.onSDKReady(session);
        return session;
      } catch (error) {
        logger.error("SDK init failed", error);
        throw error;
      }
    } else {
      logger.error("ActivityBridgeHelper is not injected. Please ensure the native SDK is loaded correctly.");
      this.isSDKReady = false;
      this.config.onSDKReady(null);
      return null;
    }
  }

  /**
   * 等待 SDK 加载完成（原生注入）
   */
  async waitForSDK() {
    return new Promise((resolve) => {
      if (isBridgeReady()) {
        resolve();
        return;
      }

      let attempts = 0;
      const maxAttempts = 60;

      const tick = () => {
        attempts += 1;
        if (isBridgeReady()) {
          resolve();
          return;
        }
        if (attempts >= maxAttempts) {
          logger.warn("ActivityBridgeHelper injection timed out. Please ensure the native SDK is injected correctly.");
          resolve();
          return;
        }
        if (attempts <= 10 && typeof requestAnimationFrame === "function") {
          requestAnimationFrame(tick);
          return;
        }
        setTimeout(tick, 50);
      };

      tick();
    });
  }

  /**
   * 设置事件完成回调
   */
  setupEventCallback() {
    /*
     * Do not retain the callback only in the SDK shim's local callback list.
     * The Android WebView injects that shim on every page finish; a later
     * injection recreates its list and silently drops listeners registered by
     * the H5 page. This is particularly easy to hit after a locale switch,
     * which reloads the whole activity page.
     *
     * The shim dispatches every native result to this page-level callback as
     * well. Keeping the handler here makes it survive shim reinjection in the
     * same document. The request coordinator consumes duplicate native
     * deliveries atomically, so SDK versions that also invoke this global
     * directly remain safe.
     */
    window.onActivityEventCompleted = this.eventCompletedCallback;
  }

  dispose() {
    if (window.onActivityEventCompleted === this.eventCompletedCallback) {
      window.onActivityEventCompleted = null;
    }
  }

  /**
   * 触发插页式激励广告（task_watch_ad 每日看视频）
   * 对应 Native: RewardedInterstitialAd，需要用户看完才算完成。
   */
  async triggerRewardAd(eventData = {}) {
    if (!window.ActivityBridgeHelper?.triggerEvent) {
      throw new Error("ActivityBridgeHelper is not injected");
    }

    const defaultEventData = {
      taskId: "task_watch_ad",
      ...eventData,
    };

    const payload = JSON.stringify(defaultEventData);
    logger.log("[SDK] triggerRewardAd payload:", defaultEventData);

    return window.ActivityBridgeHelper.triggerEvent(
      window.ActivityBridgeHelper.EventType.REWARD_AD,
      payload
    );
  }

  /**
   * 触发插页式广告（task_checkin 签到弹框看视频）
   * 对应 Native: InterstitialAd，广告关闭即视为完成。
   */
  async triggerInterstitialAd(eventData = {}) {
    if (!window.ActivityBridgeHelper?.triggerEvent) {
      throw new Error("ActivityBridgeHelper is not injected");
    }

    const defaultEventData = {
      taskId: "task_checkin",
      ...eventData,
    };

    const payload = JSON.stringify(defaultEventData);
    logger.log("[SDK] triggerInterstitialAd payload:", defaultEventData);

    return window.ActivityBridgeHelper.triggerEvent(
      window.ActivityBridgeHelper.EventType.INTERSTITIAL_AD,
      payload
    );
  }

  /**
   * 追踪事件
   */
  async trackEvent(eventType, eventData = {}) {
    if (!window.ActivityBridgeHelper?.trackEvent) {
      logger.warn("ActivityBridgeHelper is not injected, cannot track events");
      return null;
    }

    try {
      const payload = this.buildTrackEventPayload(eventData);
      return await window.ActivityBridgeHelper.trackEvent(eventType, payload);
    } catch (e) {
      logger.warn("trackEvent failed", e?.message || e);
      return null;
    }
  }

  buildTrackEventPayload(eventData = {}) {
    const userId = this.config.getUserId?.();
    const payload = { ...eventData };
    if (userId != null && userId !== "") {
      payload.user_id = userId;
    }
    return payload;
  }

  /**
   * 获取平台信息
   */
  getPlatform() {
    return window.ActivityBridgeHelper?.getPlatform?.() || "unknown";
  }
}
