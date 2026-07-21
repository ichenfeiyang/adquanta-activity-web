import { assetUrl } from "./asset-url.js";
import { alreadyCheckedInMessage } from "./activity-messages.js";
import { showToast } from "./activity-alert-ui.js";
import { bindPageElements } from "./bind-page-elements.js";
import { checkinUiMixin as checkinMixin } from "./activity-center-checkin-ui.js";
import { spinUiMixin as spinMixin } from "./activity-center-spin-ui.js";
import { newUserBonusUiMixin as newUserBonusMixin } from "./activity-center-new-user-bonus-ui.js";
import { checkinChestUiMixin as checkinChestMixin } from "./activity-center-checkin-chest-ui.js";
import { coinRainUiMixin as coinRainMixin } from "./activity-center-coin-rain-ui.js";
import { t } from "./i18n/activity-locale.js";

const DEFAULT_REDEEM_REWARD_ITEMS = [
  { type: "mobile_recharge", titleKey: "center.redeemRewardMobileRecharge", fallback: true },
  { type: "data_packs", titleKey: "center.redeemRewardDataPacks", fallback: true },
  { type: "gift_cards", titleKey: "center.redeemRewardGiftCards", fallback: true },
];

const REDEEM_REWARD_TITLE_KEYS = {
  mobile_recharge: "center.redeemRewardMobileRecharge",
  data_packs: "center.redeemRewardDataPacks",
  gift_cards: "center.redeemRewardGiftCards",
};

/**
 * UI 绑定层
 * 负责：DOM 操作、UI 更新、事件绑定
 * 只处理 UI 相关的逻辑，不包含业务逻辑
 */
export class ActivityCenterUI {
  constructor(config = {}) {
    this.elements = bindPageElements({
      goldCoins: "goldCoins",
      adTaskDesc: "ad-task-desc",
      btnWatchAd: "btn-watch-ad",
      btnSpinEntry: "btn-spin-entry",
      spinWheelModal: "spinWheelModal",
      spinWheelClose: "spinWheelClose",
      spinWheelDisk: "spinWheelDisk",
      spinWheelSpinBtn: "spinWheelSpinBtn",
      spinWheelSubtitle: "spinWheelSubtitle",
      spinRewardModal: "spinRewardModal",
      spinRewardClose: "spinRewardClose",
      spinRewardCoins: "spinRewardCoins",
      withdrawBtn: "exchangeBtn",
      adMaxCoin: "ad-max-coin",
      redeemGapPanel: "redeemGapPanel",
      redeemGapProgress: "redeemGapProgress",
      redeemGapHint: "redeemGapHint",
      redeemRewardsSection: "tc-redeem-rewards-section",
      redeemRewardsList: "tc-redeem-rewards-list",
      recentRedemptionsSection: "tc-recent-redemptions-section",
      recentRedemptionsList: "tc-recent-redemptions-list",
      coinRainSection: "tc-coin-rain-section",
      coinRainEntry: "tc-coin-rain-entry",
      coinRainEntryAction: "tc-coin-rain-entry-action",
      coinRainDesc: "tc-coin-rain-desc",
      coinRainProgress: "tc-coin-rain-progress",
      coinRainOverlay: "tc-coin-rain-overlay",
      coinRainLeave: "tc-coin-rain-leave",
      coinRainTime: "tc-coin-rain-time",
      coinRainCollected: "tc-coin-rain-collected",
      coinRainCountdown: "tc-coin-rain-countdown",
      coinRainCountdownValue: "tc-coin-rain-countdown-value",
      coinRainCountdownMax: "tc-coin-rain-countdown-max",
      coinRainStage: "tc-coin-rain-stage",
      coinRainLeaveDialog: "tc-coin-rain-leave-dialog",
      coinRainLeaveDesc: "tc-coin-rain-leave-desc",
      coinRainLeaveClose: "tc-coin-rain-leave-close",
      coinRainContinue: "tc-coin-rain-continue",
      coinRainConfirmLeave: "tc-coin-rain-confirm-leave",
      coinRainJoinedDialog: "tc-coin-rain-joined-dialog",
      coinRainJoinedClose: "tc-coin-rain-joined-close",
      coinRainJoinedOk: "tc-coin-rain-joined-ok",
      coinRainResult: "tc-coin-rain-result",
      coinRainResultClose: "tc-coin-rain-result-close",
      coinRainResultHeroImg: "tc-coin-rain-result-hero-img",
      coinRainResultTitle: "tc-coin-rain-result-title",
      coinRainResultCopy: "tc-coin-rain-result-copy",
      coinRainResultAmount: "tc-coin-rain-result-amount",
      coinRainResultUnit: "tc-coin-rain-result-unit",
      coinRainBoostOffer: "tc-coin-rain-boost-offer",
      coinRainBoostOfferCopy: "tc-coin-rain-boost-offer-copy",
      coinRainWatchAd: "tc-coin-rain-watch-ad",
      coinRainClaim: "tc-coin-rain-claim",
      adProgressVideos: "ad-progress-videos",
      adProgressBarFill: "ad-progress-bar-fill",
      adEarnedText: "ad-earned-text",
      checkinSection: "tc-checkin-section",
      dailyCheckinSection: "tc-daily-checkin-section",
      videoTaskSection: "tc-video-task-section",
      luckySpinSection: "tc-lucky-spin-section",
      signinTimerBtn: "signin-timer-btn",
      signinDialog: "signinDialog",
      signinDialogCelebration: "signinDialogCelebration",
      signinDialogTitle: "signinDialogTitle",
      signinDialogBaseCoinsWrap: "signinDialogBaseCoinsWrap",
      signinDialogBaseCoins: "signinDialogBaseCoins",
      signinDialogBoostDesc: "signinDialogBoostDesc",
      signinDialogWatchBtnLabel: "signinDialogWatchBtnLabel",
      signinDialogWatchBtn: "signinDialogWatchBtn",
      signinDialogClaimBaseOnly: "signinDialogClaimBaseOnly",
      checkinVideoTip: "tc-checkin-video-tip",
      newUserBonusModal: "newUserBonusModal",
      newUserBonusTitle: "newUserBonusTitle",
      newUserBonusAmount: "newUserBonusAmount",
      newUserBonusHeadline: "newUserBonusHeadline",
      newUserBonusHeadlineCoin: "newUserBonusHeadlineCoin",
      newUserBonusDesc: "newUserBonusDesc",
      newUserBonusVideoCoin: "newUserBonusVideoCoin",
      newUserBonusFoot: "newUserBonusFoot",
      newUserBonusDoubleBtn: "newUserBonusDoubleBtn",
      newUserBonusDoubleBtnLabel: "newUserBonusDoubleBtnLabel",
      newUserBonusMaybeLater: "newUserBonusMaybeLater",
      checkinChestModal: "checkinChestModal",
      checkinChestWatchBtn: "checkinChestWatchBtn",
      checkinChestDismissBtn: "checkinChestDismissBtn",
      checkinChestRewardModal: "checkinChestRewardModal",
      checkinChestRewardCoins: "checkinChestRewardCoins",
      checkinChestRewardClose: "checkinChestRewardClose",
      checkinChestRewardClaimBtn: "checkinChestRewardClaimBtn",
      checkinPill: "tc-checkin-pill",
      checkinDaysContainer: "tc-checkin-days-container",
    });

    this.spinLabels = Array.from({ length: 8 }, (_, i) =>
      document.querySelector(`.tc-spin-label-${i + 1}`),
    );
    this.spinCardLabels = Array.from({ length: 8 }, (_, i) =>
      document.querySelector(`.tc-spin-card-label-${i + 1}`),
    );

    this.config = {
      onWatchAdClick: config.onWatchAdClick || (() => {}),
      onSpinWheelOpen: config.onSpinWheelOpen || (() => {}),
      onSpinRequest: config.onSpinRequest || (async () => ({ ok: false })),
      onWithdrawClick: config.onWithdrawClick || (() => {}),
      onSigninClick: config.onSigninClick || (() => {}),
      onSigninWatchVideoClick: config.onSigninWatchVideoClick || (() => {}),
      onSigninDialogDismiss: config.onSigninDialogDismiss || (() => {}),
      onNewUserBonusVideoClick: config.onNewUserBonusVideoClick || (() => {}),
      onNewUserBonusDismissClick: config.onNewUserBonusDismissClick || (() => {}),
      onCheckinChestWatchClick: config.onCheckinChestWatchClick || (() => {}),
      onCheckinChestDismissClick: config.onCheckinChestDismissClick || (() => {}),
      onCheckinChestDayClick: config.onCheckinChestDayClick || (() => {}),
      onCoinRainEntryClick: config.onCoinRainEntryClick || (() => {}),
      onCoinRainSettle: config.onCoinRainSettle || (async () => ({ ok: false })),
      onCoinRainAbandon: config.onCoinRainAbandon || (() => {}),
      onCoinRainWatchAd: config.onCoinRainWatchAd || (() => {}),
      ...config,
    };

    this.dailySpinLimit = 5;
    this.spinPrizePool = [10, 20, 30, 50, 100, 150, 200, 10];
    this.currentSpinAvailable = this.loadSpinAvailableState();
    // Turntable bottom-button state machine:
    // - needsWatch=true  => show "Watch to Spin/Watch to Spin Again"
    // - needsWatch=false => show "Spin Now" and allow wheel spin
    this._turntableNeedsWatch = true;
    this.spinRotation = 0;
    this._spinInFlight = false;
    this._waitingAdForSpin = false;
    this._signinVideoCompleted = false;
    this._signinTotalCoin = 0;
    this._lastGoldCoins = null;
    this._lastCheckinFingerprint = "";
    this._lastSpinPoolKey = "";
    this._newUserBonus = null;
    this._checkinChest = null;
    this.recentRedemptionItems = [];
    this.recentRedemptionNextIndex = 0;
    this.recentRedemptionTimer = 0;
    this._finishRecentRedemptionAnimation = null;
    this._recentVisibilityHandler = () => {
      if (document.hidden) this.stopRecentRedemptionRotation();
      else this.startRecentRedemptionRotation();
    };
    document.addEventListener("visibilitychange", this._recentVisibilityHandler);
  }





























  resolveSectionElement(cachedEl, cardSelector) {
    if (cachedEl) return cachedEl;
    const card = document.querySelector(cardSelector);
    return card ? card.closest("section") : null;
  }

  getCheckinSectionEl() {
    return this.resolveSectionElement(this.elements.dailyCheckinSection, ".tc-checkin-card");
  }

  getFlowSectionEl() {
    return this.elements.videoTaskSection || document.getElementById("tc-video-task-section");
  }

  getLuckySpinSectionEl() {
    return this.resolveSectionElement(this.elements.luckySpinSection, ".tc-video-card");
  }

  /** Lucky spin / daily video task card (not the static flow intro). */
  getVideoTaskSectionEl() {
    return this.getLuckySpinSectionEl();
  }

  updateFeatureVisibility(visibility = {}) {
    const showCheckin = visibility.checkin === true;
    const showVideo = visibility.video === true;

    // Wallet + redeem entry: always visible (independent of task modules).
    const balanceSection = this.elements.checkinSection || document.getElementById("tc-checkin-section");
    if (balanceSection) balanceSection.style.display = "";

    // Static flow intro: always visible so CDN first paint is not a blank page.
    const flowSection = this.getFlowSectionEl();
    if (flowSection) flowSection.style.display = "";

    // Daily check-in card: show only when checkin task exists
    const dailyCheckinSection = this.getCheckinSectionEl();
    if (dailyCheckinSection) dailyCheckinSection.style.display = showCheckin ? "" : "none";

    // Lucky spin task card: show only when video task exists
    const luckySection = this.getLuckySpinSectionEl();
    if (luckySection) luckySection.style.display = showVideo ? "" : "none";
  }

  /**
   * Show default shell immediately before /activity/info returns.
   */
  renderInitialShell() {
    // Show safe defaults immediately; /activity/info refines visibility and data.
    this.updateFeatureVisibility({ checkin: true, video: true });
    this.updateAssets({ goldCoins: 0 });
    this.updateCheckin(null);
    this.renderTurntableFromCoins(this.spinPrizePool);
    this.setAdTaskDescription(this.spinPrizePool);
    this.renderAdTaskProgress(0, 0, 0);
    this.updateRedeemRewards({ fallback: true });
    this.updateRecentRedemptions([]);
    this.resetWatchSpinButton();
  }

  /** 将展示金额映射到转盘扇区（优先精确匹配，找不到再取最近） */








































  /**
   * Bottom button (tc-spin-now-btn) click handler:
   * - Watch mode: trigger reward ad and wait for SDK callback
   * - Spin mode: execute wheel rotation (consume 1 spin chance)
   */


  /**
   * 更新资产显示（未获取到数据前缺省 0）
   */
  updateAssets(assets) {
    if (this.elements.goldCoins) {
      const v = assets && typeof assets.goldCoins === "number" ? assets.goldCoins : 0;
      if (v === this._lastGoldCoins) return;
      this._lastGoldCoins = v;
      this.elements.goldCoins.textContent = v;
    }
  }

  formatCoinNumber(value) {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) return "0";
    return Math.max(0, Math.round(n)).toLocaleString("en-US");
  }

  updateRedeemGap(gap) {
    const panel = this.elements.redeemGapPanel;
    const hint = this.elements.redeemGapHint;
    const progress = this.elements.redeemGapProgress;
    if (!panel || !hint) return;
    if (!gap || gap.enabled !== true) {
      hint.textContent = "";
      if (progress) progress.style.width = "0%";
      panel.style.display = "none";
      return;
    }
    const minCoin = Math.max(0, Number(gap.min_coin ?? 0) || 0);
    const remaining = Math.max(0, Number(gap.remaining_coin ?? 0) || 0);
    const current = Math.max(0, minCoin - remaining);
    const percent = minCoin > 0 ? Math.min(100, Math.max(0, (current / minCoin) * 100)) : 0;
    if (progress) progress.style.width = `${percent}%`;
    hint.textContent =
      gap.can_redeem === true || remaining <= 0
        ? t("center.redeemGapReady", { count: this.formatCoinNumber(minCoin) })
        : t("center.redeemGapNeed", {
            count: this.formatCoinNumber(remaining),
            target: this.formatCoinNumber(minCoin),
          });
    panel.style.display = "";
  }

  redeemRewardCategoryIcon(type) {
    if (type === "mobile_recharge") {
      const icon = document.createElement("span");
      icon.className = "tc-redeem-reward-currency";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "₹";
      return icon;
    }
    if (type === "data_packs") {
      const icon = document.createElement("span");
      icon.className = "tc-redeem-reward-wifi";
      icon.setAttribute("aria-hidden", "true");
      return icon;
    }
    const img = document.createElement("img");
    img.alt = "";
    img.width = 28;
    img.height = 28;
    img.loading = "lazy";
    img.decoding = "async";
    if (type === "gift_cards") {
      img.src = assetUrl("icons/card_giftcard.svg");
      return img;
    }
    img.src = assetUrl("icons/phone_iphone.svg");
    return img;
  }

  updateRedeemRewards(rewards) {
    const section = this.elements.redeemRewardsSection;
    const list = this.elements.redeemRewardsList;
    if (!section || !list) return;
    const hasLiveItems = rewards?.enabled === true && Array.isArray(rewards.items) && rewards.items.length > 0;
    const useFallbackItems = rewards?.fallback === true;
    const items = hasLiveItems ? rewards.items : useFallbackItems ? DEFAULT_REDEEM_REWARD_ITEMS : [];
    list.replaceChildren();
    list.className = "tc-redeem-rewards-list";
    if (!items.length) {
      section.style.display = "none";
      return;
    }
    for (const item of items) {
      const minCoin = Number(item.min_coin ?? 0) || 0;
      const isFallback = item.fallback === true;
      if (!isFallback && minCoin <= 0) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tc-redeem-reward-item";
      button.dataset.category = String(item.type || "");
      const icon = document.createElement("span");
      icon.className = "tc-redeem-reward-icon";
      icon.appendChild(this.redeemRewardCategoryIcon(item.type));
      const copy = document.createElement("span");
      copy.className = "tc-redeem-reward-copy";
      const name = document.createElement("span");
      name.className = "tc-redeem-reward-name";
      const titleKey = REDEEM_REWARD_TITLE_KEYS[item.type] || item.titleKey;
      name.textContent = titleKey ? t(titleKey) : item.title || t("center.redeemRewardsFallbackTitle");
      const threshold = document.createElement("span");
      threshold.className = "tc-redeem-reward-threshold";
      threshold.textContent = isFallback
        ? t("center.redeemRewardsThresholdLoading")
        : t("center.redeemRewardsFromCoins", { count: this.formatCoinNumber(minCoin) });
      copy.append(name, threshold);
      const arrow = document.createElement("span");
      arrow.className = "tc-redeem-reward-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "›";
      button.append(icon, copy, arrow);
      button.addEventListener("click", () => this.config.onWithdrawClick(item.type));
      list.appendChild(button);
    }
    const renderedCount = list.children.length;
    if (renderedCount > 0) {
      list.classList.add(`tc-redeem-rewards-list--count-${Math.min(renderedCount, 3)}`);
    }
    section.style.display = renderedCount ? "" : "none";
  }

  updateRecentRedemptions(items) {
    const section = this.elements.recentRedemptionsSection;
    const list = this.elements.recentRedemptionsList;
    if (!section || !list) return;
    this.stopRecentRedemptionRotation();
    this.finishRecentRedemptionAnimation();
    this.recentRedemptionItems = Array.isArray(items) ? items : [];
    this.recentRedemptionNextIndex = Math.min(3, this.recentRedemptionItems.length);
    if (!this.recentRedemptionItems.length) {
      list.replaceChildren();
      section.style.display = "none";
      return;
    }
    section.style.display = "";
    this.renderRecentRedemptionBatch();
    this.startRecentRedemptionRotation();
  }

  renderRecentRedemptionBatch() {
    const list = this.elements.recentRedemptionsList;
    if (!list) return;
    const track = document.createElement("div");
    track.className = "tc-recent-redemptions-track";
    for (const item of this.recentRedemptionItems.slice(0, 3)) {
      track.appendChild(this.createRecentRedemptionRow(item));
    }
    list.replaceChildren(track);
  }

  createRecentRedemptionRow(item) {
    const row = document.createElement("div");
    row.className = "tc-recent-redemption-item";

    const user = document.createElement("span");
    user.className = "tc-recent-redemption-user";
    user.textContent = item.maskedUserId;

    const reward = document.createElement("span");
    reward.className = "tc-recent-redemption-reward";
    const icon = document.createElement("span");
    icon.className = `tc-recent-redemption-icon tc-recent-redemption-icon--${item.rewardType}`;
    icon.appendChild(this.recentRedemptionIcon(item));
    const name = document.createElement("span");
    name.className = "tc-recent-redemption-name";
    name.textContent = item.rewardName;
    reward.append(icon, name);

    const date = document.createElement("time");
    date.className = "tc-recent-redemption-date";
    date.dateTime = item.redeemedDate;
    date.textContent = item.redeemedDate;

    const success = document.createElement("span");
    success.className = "tc-recent-redemption-success";
    success.setAttribute("aria-label", t("common.completed"));
    success.textContent = "✓";
    row.append(user, reward, date, success);
    return row;
  }

  animateRecentRedemptionBatch() {
    const list = this.elements.recentRedemptionsList;
    if (!list || this._finishRecentRedemptionAnimation) return;
    const track = list.firstElementChild;
    const nextItem = this.recentRedemptionItems[this.recentRedemptionNextIndex];
    if (!nextItem) return;
    const nextRow = this.createRecentRedemptionRow(nextItem);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (!track) {
      this.renderRecentRedemptionBatch();
      return;
    }
    if (reduceMotion) {
      track.firstElementChild?.remove();
      track.appendChild(nextRow);
      this.recentRedemptionNextIndex = (this.recentRedemptionNextIndex + 1) % this.recentRedemptionItems.length;
      return;
    }

    track.appendChild(nextRow);
    this.recentRedemptionNextIndex = (this.recentRedemptionNextIndex + 1) % this.recentRedemptionItems.length;
    let finished = false;
    let animationFrame = 0;
    let fallbackTimer = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      track.removeEventListener("transitionend", finish);
      track.classList.remove("tc-recent-redemptions-track--animating");
      track.firstElementChild?.remove();
      this._finishRecentRedemptionAnimation = null;
    };
    this._finishRecentRedemptionAnimation = finish;
    track.addEventListener("transitionend", finish);
    animationFrame = window.requestAnimationFrame(() => {
      track.classList.add("tc-recent-redemptions-track--animating");
      fallbackTimer = window.setTimeout(finish, 1100);
    });
  }

  finishRecentRedemptionAnimation() {
    this._finishRecentRedemptionAnimation?.();
  }

  recentRedemptionIcon(item) {
    if (item.rewardIconUrl) {
      const image = document.createElement("img");
      image.src = item.rewardIconUrl;
      image.alt = "";
      image.width = 24;
      image.height = 24;
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      return image;
    }
    if (item.rewardType === "data") {
      const glyph = document.createElement("span");
      glyph.className = "tc-recent-redemption-data-glyph";
      glyph.textContent = "↕";
      return glyph;
    }
    const image = document.createElement("img");
    image.src = assetUrl(item.rewardType === "gift_card" ? "icons/card_giftcard.svg" : "icons/phone_iphone.svg");
    image.alt = "";
    image.width = 24;
    image.height = 24;
    image.loading = "lazy";
    image.decoding = "async";
    return image;
  }

  startRecentRedemptionRotation() {
    if (document.hidden || this.recentRedemptionTimer || this.recentRedemptionItems.length <= 3) return;
    this.recentRedemptionTimer = window.setInterval(() => {
      this.animateRecentRedemptionBatch();
    }, 3000);
  }

  stopRecentRedemptionRotation() {
    if (!this.recentRedemptionTimer) return;
    window.clearInterval(this.recentRedemptionTimer);
    this.recentRedemptionTimer = 0;
  }

  destroyRecentRedemptions() {
    this.stopRecentRedemptionRotation();
    this.finishRecentRedemptionAnimation();
    document.removeEventListener("visibilitychange", this._recentVisibilityHandler);
  }

  /**
   * 更新日常视频任务 UI（type === 'video' 的 task.detail：today_watched, daily_limit, remain_count, coin, roulette）
   */
  updateTasks(tasks) {
    const luckySection = this.elements.luckySpinSection || document.getElementById("tc-lucky-spin-section");
    if (!tasks || !tasks.watchAd) {
      const videoSection = this.getVideoTaskSectionEl();
      if (videoSection) videoSection.style.display = "none";
      if (luckySection) luckySection.style.display = "none";
      return;
    }
    const videoSection = this.getVideoTaskSectionEl();
    if (videoSection) videoSection.style.display = "";
    if (luckySection) luckySection.style.display = "";

    const task = tasks.watchAd;
    const r = task.roulette;

    this.syncTurntableFromTask(task);
    this.syncSpinAvailableFromTask(task);

    this.setAdTaskDescription(r?.roulette_coins);
    this.syncAdTaskProgressFromTask(task);
    this.resetWatchSpinButton();
    if (this.elements.btnSpinEntry) {
      this.elements.btnSpinEntry.disabled = false;
      this.elements.btnSpinEntry.classList.remove("is-completed");
    }
  }













  /**
   * @param {{ coinFromCheckin?: number, video_coin?: number, coin?: number, alreadyChecked?: boolean }} reward
   */


  /**
   * 隐藏签到成功弹框
   */


  /**
   * 根据后端签到 detail 渲染 7 天签到卡片
   * 未获取到数据时天数、金币均用缺省值 0；已签到展示与 pill 按 continuous_days
   * @param {{ continuous_days: number, super_reward_day?: number, days: Array<{ day: number, coin: number, video_coin: number, current: boolean, received: boolean, video_received: boolean }> }} detail
   */










  /**
   * 绑定事件
   */
  bindEvents() {
    this.bindCoinRainEvents?.();
    // 看广告/领取按钮
    if (this.elements.btnWatchAd) {
      this.elements.btnWatchAd.addEventListener("click", () => {
        if (this.elements.btnWatchAd.disabled) return;
        if (this.isSpinWheelVisible()) return;
        this.showSpinWheel();
      });
    }
    // Intentionally disable the "play" entry click.
    // Only "Watch & Spin" should open the spin wheel modal.
    if (this.elements.btnSpinEntry) {
      this.elements.btnSpinEntry.style.pointerEvents = "none";
    }
    if (this.elements.spinWheelClose) {
      this.elements.spinWheelClose.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.hideSpinWheel();
      });
    }
    if (this.elements.spinWheelSpinBtn) {
      this.elements.spinWheelSpinBtn.addEventListener("click", () => this.handleSpinWheelBottomClick());
    }
    if (this.elements.spinRewardClose) {
      this.elements.spinRewardClose.addEventListener("click", () => {
        this.closeSpinRewardDialog();
      });
    }
    if (this.elements.spinRewardModal) {
      this.elements.spinRewardModal.addEventListener("click", (e) => {
        if (e.target === this.elements.spinRewardModal) {
          this.closeSpinRewardDialog();
        }
      });
    }

    // 提现/兑换按钮
    if (this.elements.withdrawBtn) {
      this.elements.withdrawBtn.addEventListener("click", () => {
        this.config.onWithdrawClick();
      });
    }

    // 签到按钮
    if (this.elements.signinTimerBtn) {
      this.elements.signinTimerBtn.addEventListener("click", () => {
        const btn = this.elements.signinTimerBtn;
        if (btn.classList.contains("is-completed")) {
          showToast(alreadyCheckedInMessage(), "info");
          return;
        }
        if (btn.disabled || btn.getAttribute("aria-disabled") === "true") return;
        this.config.onSigninClick();
      });
    }

    // 签到成功弹框 - 仅领取基础奖励（关闭弹框）
    if (this.elements.signinDialogClaimBaseOnly) {
      this.elements.signinDialogClaimBaseOnly.addEventListener("click", () => {
        this.hideSigninDialog();
        this.config.onSigninDialogDismiss();
      });
    }

    // 签到成功弹框 - 看视频获取额外金币
    if (this.elements.signinDialogWatchBtn) {
      this.elements.signinDialogWatchBtn.addEventListener("click", () => {
        if (this.elements.signinDialogWatchBtn.disabled) return;
        this.config.onSigninWatchVideoClick();
      });
    }

    if (this.elements.newUserBonusDoubleBtn) {
      this.elements.newUserBonusDoubleBtn.addEventListener("click", () => {
        if (this.elements.newUserBonusDoubleBtn.disabled) return;
        this.config.onNewUserBonusVideoClick(this._newUserBonus);
      });
    }

    if (this.elements.newUserBonusMaybeLater) {
      this.elements.newUserBonusMaybeLater.addEventListener("click", () => {
        if (this.elements.newUserBonusMaybeLater.disabled) return;
        this.config.onNewUserBonusDismissClick(this._newUserBonus);
      });
    }

    if (this.elements.checkinChestWatchBtn) {
      this.elements.checkinChestWatchBtn.addEventListener("click", () => {
        if (!this.elements.checkinChestWatchBtn.disabled) this.config.onCheckinChestWatchClick(this._checkinChest);
      });
    }
    if (this.elements.checkinChestDismissBtn) {
      this.elements.checkinChestDismissBtn.addEventListener("click", () => {
        if (!this.elements.checkinChestDismissBtn.disabled) this.config.onCheckinChestDismissClick(this._checkinChest);
      });
    }
    for (const element of [this.elements.checkinChestRewardClose, this.elements.checkinChestRewardClaimBtn]) {
      element?.addEventListener("click", () => this.hideCheckinChestRewardDialog());
    }

    if (!this._scrollLockTouchBound) {
      this._scrollLockTouchBound = true;
      document.addEventListener(
        "touchmove",
        (e) => {
          if (!this._bodyScrollLocked) return;
          const target = e.target;
          if (target instanceof Node) {
            if (this.elements.spinWheelModal?.contains(target)) return;
            if (this.elements.spinRewardModal?.contains(target)) return;
            if (this.elements.newUserBonusModal?.contains(target)) return;
          }
          e.preventDefault();
        },
        { passive: false },
      );
    }
  }

  /**
   * 设置签到弹框“看视频”按钮 loading/禁用状态（防连点）
   */

}

Object.assign(ActivityCenterUI.prototype, spinMixin, checkinMixin, newUserBonusMixin, checkinChestMixin, coinRainMixin);
