import { assetUrl } from "./asset-url.js";
import { alreadyCheckedInMessage } from "./activity-messages.js";
import { showToast } from "./activity-alert-ui.js";
import { bindPageElements } from "./bind-page-elements.js";
import { checkinUiMixin as checkinMixin } from "./activity-center-checkin-ui.js";
import { spinUiMixin as spinMixin } from "./activity-center-spin-ui.js";

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
      checkinPill: "tc-checkin-pill",
      checkinDaysContainer: "tc-checkin-days-container",
    });

    this.spinLabels = Array.from({ length: 8 }, (_, i) =>
      document.querySelector(`.tc-spin-label-${i + 1}`),
    );

    this.config = {
      onWatchAdClick: config.onWatchAdClick || (() => {}),
      onSpinWheelOpen: config.onSpinWheelOpen || (() => {}),
      onSpinRequest: config.onSpinRequest || (async () => ({ ok: false })),
      onWithdrawClick: config.onWithdrawClick || (() => {}),
      onSigninClick: config.onSigninClick || (() => {}),
      onSigninWatchVideoClick: config.onSigninWatchVideoClick || (() => {}),
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
      });
    }

    // 签到成功弹框 - 看视频获取额外金币
    if (this.elements.signinDialogWatchBtn) {
      this.elements.signinDialogWatchBtn.addEventListener("click", () => {
        if (this.elements.signinDialogWatchBtn.disabled) return;
        this.hideSigninDialog();
        this.config.onSigninWatchVideoClick();
      });
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

Object.assign(ActivityCenterUI.prototype, spinMixin, checkinMixin);
