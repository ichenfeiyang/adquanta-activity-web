import { assetUrl } from "./asset-url.js";

/**
 * UI 绑定层
 * 负责：DOM 操作、UI 更新、事件绑定
 * 只处理 UI 相关的逻辑，不包含业务逻辑
 */
export class WelfareCenterUI {
  constructor(config = {}) {
    this.elements = {
      goldCoins: document.getElementById("goldCoins"),
      adRewardAmount: document.getElementById("ad-reward-amount"),
      adTaskDesc: document.getElementById("ad-task-desc"),
      btnWatchAd: document.getElementById("btn-watch-ad"),
      btnSpinEntry: document.getElementById("btn-spin-entry"),
      spinWheelModal: document.getElementById("spinWheelModal"),
      spinWheelClose: document.getElementById("spinWheelClose"),
      spinWheelDisk: document.getElementById("spinWheelDisk"),
      spinWheelSpinBtn: document.getElementById("spinWheelSpinBtn"),
      spinWheelSubtitle: document.getElementById("spinWheelSubtitle"),
      spinRewardModal: document.getElementById("spinRewardModal"),
      spinRewardClose: document.getElementById("spinRewardClose"),
      spinRewardCoins: document.getElementById("spinRewardCoins"),
      userGreeting: document.getElementById("userGreeting"),
      toast: document.getElementById("toast"),
      withdrawBtn: document.getElementById("exchangeBtn"),
      adProgressVideos: document.getElementById("ad-progress-videos"),
      adEarnedText: document.getElementById("ad-earned-text"),
      checkinSection: document.getElementById("tc-checkin-section"),
      dailyCheckinSection: document.getElementById("tc-daily-checkin-section"),
      videoTaskSection: document.getElementById("tc-video-task-section"),
      luckySpinSection: document.getElementById("tc-lucky-spin-section"),
      signinTimerBtn: document.getElementById("signin-timer-btn"),
      signinDialog: document.getElementById("signinDialog"),
      signinDialogCelebration: document.getElementById("signinDialogCelebration"),
      signinDialogTitle: document.getElementById("signinDialogTitle"),
      signinDialogBaseCoinsWrap: document.getElementById("signinDialogBaseCoinsWrap"),
      signinDialogBaseCoins: document.getElementById("signinDialogBaseCoins"),
      signinDialogVideoCoin: document.getElementById("signinDialogVideoCoin"),
      signinDialogMultiplier: document.getElementById("signinDialogMultiplier"),
      signinDialogWatchBtn: document.getElementById("signinDialogWatchBtn"),
      signinDialogClaimBaseOnly: document.getElementById("signinDialogClaimBaseOnly"),
      checkinPill: document.getElementById("tc-checkin-pill"),
      checkinDaysContainer: document.getElementById("tc-checkin-days-container"),
    };

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
    if (this.elements.adProgressVideos) {
      this.elements.adProgressVideos.textContent = "0 Spins";
    }
    // Turntable bottom-button state machine:
    // - needsWatch=true  => show "Watch to Spin/Watch to Spin Again"
    // - needsWatch=false => show "Spin Now" and allow wheel spin
    this._turntableNeedsWatch = true;
    this.spinRotation = 0;
    this._spinInFlight = false;
    this._waitingAdForSpin = false;
    this._signinVideoCompleted = false;
    this._lastGoldCoins = null;
    this._lastCheckinFingerprint = "";
    this._lastSpinPoolKey = "";
  }

  isSpinWheelVisible() {
    return this.elements.spinWheelModal?.style.display === "flex";
  }

  resetWatchSpinButton() {
    const btn = this.elements.btnWatchAd;
    if (!btn) return;
    btn.classList.remove("can-claim", "is-completed");
    this.setWatchSpinButtonLabel("Watch & Spin");
    btn.disabled = false;
  }

  getSpinWheelBottomButtonLabel(forceDailyFirst) {
    if (forceDailyFirst) return "Watch to Spin";
    if (this._turntableNeedsWatch) return "Watch to Spin Again";
    return "Spin Now";
  }

  setSpinWheelBottomButton({ label, disabled } = {}) {
    const btn = this.elements.spinWheelSpinBtn;
    if (!btn) return;
    if (label !== undefined) btn.textContent = label;
    if (disabled !== undefined) btn.disabled = disabled;
  }

  setSpinWheelVisible(visible) {
    document.body.classList.toggle("tc-spin-wheel-open", visible);
    const modal = this.elements.spinWheelModal;
    if (modal) modal.style.display = visible ? "flex" : "none";
  }

  closeSpinRewardDialog() {
    this.hideSpinRewardDialog();
    this.enterSpinWatchAgainMode();
  }

  enterSpinWatchAgainMode() {
    this._turntableNeedsWatch = true;
    this.setSpinWheelBottomButton({ label: "Watch to Spin Again", disabled: false });
    this.updateSpinWheelSubtitle();
  }

  getTodayDateKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }

  getSpinWheelSubtitleText() {
    if (this._turntableNeedsWatch) {
      return "Tap Watch to Spin to watch a video and earn a spin chance.";
    }
    return "Tap Spin Now to spin your reward!";
  }

  updateSpinWheelSubtitle() {
    if (!this.elements.spinWheelSubtitle) return;
    this.elements.spinWheelSubtitle.textContent = this.getSpinWheelSubtitleText();
  }

  setWatchSpinButtonLabel(label) {
    const btn = this.elements.btnWatchAd;
    if (!btn) return;
    const span = btn.querySelector("span");
    if (span) {
      span.textContent = label;
      return;
    }
    btn.textContent = label;
  }

  resolveSectionElement(cachedEl, cardSelector) {
    if (cachedEl) return cachedEl;
    const card = document.querySelector(cardSelector);
    return card ? card.closest("section") : null;
  }

  getCheckinSectionEl() {
    return this.resolveSectionElement(this.elements.checkinSection, ".tc-checkin-card");
  }

  getVideoTaskSectionEl() {
    return this.resolveSectionElement(this.elements.videoTaskSection, ".tc-video-card");
  }

  updateFeatureVisibility(visibility = {}) {
    const showCheckin = visibility.checkin === true;
    const showVideo = visibility.video === true;
    const showAny = showCheckin || showVideo;

    // Balance card: show whenever any task exists
    const balanceSection = this.elements.checkinSection || document.getElementById("tc-checkin-section");
    if (balanceSection) balanceSection.style.display = showAny ? "" : "none";

    // Daily check-in card: show only when checkin task exists
    const dailyCheckinSection = this.elements.dailyCheckinSection || document.getElementById("tc-daily-checkin-section");
    if (dailyCheckinSection) dailyCheckinSection.style.display = showCheckin ? "" : "none";

    // Flow intro card: show only when video task exists
    const videoSection = this.getVideoTaskSectionEl();
    if (videoSection) videoSection.style.display = showVideo ? "" : "none";

    // Lucky spin task card: show only when video task exists
    const luckySection = this.elements.luckySpinSection || document.getElementById("tc-lucky-spin-section");
    if (luckySection) luckySection.style.display = showVideo ? "" : "none";
  }

  /**
   * Show default shell immediately before /activity/info returns.
   */
  renderInitialShell() {
    this.updateFeatureVisibility({ checkin: true, video: true });
    this.updateAssets({ goldCoins: 0 });
    this.renderTurntableFromCoins(this.spinPrizePool);
    if (this.elements.adTaskDesc) {
      this.elements.adTaskDesc.textContent = "Watch videos for spin chances(each video grants one spin).";
    }
    if (this.elements.adProgressVideos) {
      this.elements.adProgressVideos.textContent = "0 Spins";
    }
    if (this.elements.adEarnedText) {
      this.elements.adEarnedText.textContent = "0 Coins";
    }
    this.resetWatchSpinButton();
  }

  /** 将展示金额映射到转盘扇区（优先精确匹配，找不到再取最近） */
  _sectorIndexForPrize(prize) {
    const p = Number(prize);
    if (!Number.isFinite(p)) return 0;
    const pool = this.spinPrizePool;
    const exact = pool.findIndex((v) => Number(v) === p);
    if (exact >= 0) return exact;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const d = Math.abs(Number(pool[i]) - p);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  getTodaySpinAvailableKey() {
    return `activity_turntable_available_${this.getTodayDateKey()}`;
  }

  getTodayTurntableDailyFirstShownKey() {
    return `activity_turntable_daily_first_shown_${this.getTodayDateKey()}`;
  }

  isTodayTurntableDailyFirstShown() {
    try {
      return localStorage.getItem(this.getTodayTurntableDailyFirstShownKey()) === "1";
    } catch (_) {
      return false;
    }
  }

  markTodayTurntableDailyFirstShown() {
    try {
      localStorage.setItem(this.getTodayTurntableDailyFirstShownKey(), "1");
    } catch (_) {}
  }

  loadSpinAvailableState() {
    try {
      const raw = localStorage.getItem(this.getTodaySpinAvailableKey()) || "0";
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch (_) {
      return 0;
    }
  }

  saveSpinAvailableState() {
    try {
      localStorage.setItem(this.getTodaySpinAvailableKey(), String(this.currentSpinAvailable));
    } catch (_) {}
  }

  clampSpinCountByLimit() {
    const limit = Number(this.dailySpinLimit || 0);
    if (limit >= 0) {
      this.currentSpinAvailable = Math.min(this.currentSpinAvailable, limit);
    }
    this.currentSpinAvailable = Math.max(0, Math.floor(this.currentSpinAvailable));
    this.saveSpinAvailableState();
  }

  addSpinChance(delta = 1) {
    if (this.config.isDailyAdLimitReached?.()) return;
    const inc = Number(delta);
    if (!Number.isFinite(inc) || inc <= 0) return;
    this.currentSpinAvailable += Math.floor(inc);
    this.clampSpinCountByLimit();
  }

  consumeSpinChance(delta = 1) {
    const dec = Number(delta);
    if (!Number.isFinite(dec) || dec <= 0) return;
    this.currentSpinAvailable = Math.max(0, this.currentSpinAvailable - Math.floor(dec));
    this.saveSpinAvailableState();
  }

  renderTurntableFromCoins(rouletteCoins = []) {
    const list = Array.isArray(rouletteCoins) ? rouletteCoins.slice(0, 8) : [];
    while (list.length < 8) list.push(0);
    this.spinPrizePool = list.map((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    });
    const poolKey = this.spinPrizePool.join(",");
    if (poolKey === this._lastSpinPoolKey) return;
    this._lastSpinPoolKey = poolKey;
    for (let i = 0; i < 8; i += 1) {
      const el = this.spinLabels[i];
      if (el) el.textContent = String(this.spinPrizePool[i] ?? 0);
    }
  }

  syncTurntableFromTask(task) {
    if (!task) return;
    const limit = Number(task.daily_limit ?? this.dailySpinLimit);
    if (Number.isFinite(limit) && limit > 0) this.dailySpinLimit = limit;
    const coins = task?.roulette?.roulette_coins;
    this.renderTurntableFromCoins(coins);
    this.clampSpinCountByLimit();
  }

  syncSpinAvailableFromTask(task) {
    if (!task) return;
    const completed = Number(task.completed ?? 0);
    this.currentSpinAvailable = Math.min(this.currentSpinAvailable, completed);
    this.saveSpinAvailableState();
  }

  renderAdTaskProgress(completed, earnedPool, taskReward = 0) {
    const spunCount = Math.max(0, Number(completed) - Number(this.currentSpinAvailable || 0));
    if (this.elements.adProgressVideos) {
      this.elements.adProgressVideos.textContent = `${spunCount} Spins`;
    }
    if (this.elements.adEarnedText) {
      const earnedCoins = earnedPool != null ? earnedPool : completed * taskReward;
      this.elements.adEarnedText.textContent = `${earnedCoins} Coins`;
    }
  }

  refreshAdTaskStats() {
    const task = this.config.getAdTaskStatus?.();
    if (!task) return;
    const completed = Number(task.completed ?? 0);
    const r = task.roulette;
    const earnedPool = r != null && typeof r.earned_coins === "number" ? r.earned_coins : null;
    this.renderAdTaskProgress(completed, earnedPool, task.reward ?? 0);
  }

  isWaitingAdForSpin() {
    return this._waitingAdForSpin;
  }

  async handleRewardAdCompletedForSpin() {
    if (!this._waitingAdForSpin) return;
    this._waitingAdForSpin = false;
    if (this.config.isDailyAdLimitReached?.()) {
      const message = this.config.getDailyAdLimitMessage?.() || "Daily ad watch limit reached";
      this.handleRewardAdFailedForSpin(message);
      this.refreshAdTaskStats();
      return;
    }
    this.addSpinChance(1);
    // After watching ad successfully, user must click Spin Now manually.
    this._turntableNeedsWatch = false;
    this.setSpinWheelBottomButton({ label: "Spin Now", disabled: false });
    this.updateSpinWheelSubtitle();
  }

  handleRewardAdFailedForSpin(message = "Ad failed to play, please try again") {
    this._waitingAdForSpin = false;
    this.enterSpinWatchAgainMode();
    this.showToast(message, "warning");
  }

  /**
   * Bottom button (tc-spin-now-btn) click handler:
   * - Watch mode: trigger reward ad and wait for SDK callback
   * - Spin mode: execute wheel rotation (consume 1 spin chance)
   */
  handleSpinWheelBottomClick() {
    const btn = this.elements.spinWheelSpinBtn;
    if (btn?.disabled) return;

    if (this._turntableNeedsWatch) {
      if (this._waitingAdForSpin) return;
      if (this.config.isDailyAdLimitReached?.()) {
        const message = this.config.getDailyAdLimitMessage?.() || "Daily ad watch limit reached";
        this.handleRewardAdFailedForSpin(message);
        this.refreshAdTaskStats();
        return;
      }
      this._waitingAdForSpin = true;
      this.setSpinWheelBottomButton({ disabled: true });
      this.config.onWatchAdClick();
      return;
    }

    this.setSpinWheelBottomButton({ disabled: true });
    this.spinWheel();
  }

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
    const completed = task.completed ?? 0;
    const r = task.roulette;
    const totalPool = r != null && typeof r.total_coins === "number" ? r.total_coins : 0;
    const earnedPool = r != null && typeof r.earned_coins === "number" ? r.earned_coins : null;
    const nextCoin = r != null && typeof r.next_coin === "number" ? r.next_coin : null;

    this.syncTurntableFromTask(task);
    this.syncSpinAvailableFromTask(task);

    const rewardDisplay = nextCoin != null ? String(nextCoin) : String(task.reward ?? 0);
    if (this.elements.adRewardAmount) {
      this.elements.adRewardAmount.textContent = rewardDisplay;
    }
    if (this.elements.adTaskDesc) {
      const poolHint = totalPool > 0 && earnedPool != null ? ` Roulette pool: ${earnedPool} coins.` : "";
      this.elements.adTaskDesc.textContent = `Watch videos for spin chances(each video grants one spin).${poolHint}`;
    }
    this.renderAdTaskProgress(completed, earnedPool, task.reward ?? 0);
    this.resetWatchSpinButton();
    if (this.elements.btnSpinEntry) {
      this.elements.btnSpinEntry.disabled = false;
      this.elements.btnSpinEntry.classList.remove("is-completed");
    }
  }

  resetSpinWheelRotation() {
    this.spinRotation = 0;
    const disk = this.elements.spinWheelDisk;
    if (!disk) return;
    disk.style.transition = "none";
    disk.style.transform = "rotate(0deg)";
    void disk.offsetWidth;
    disk.style.transition = "";
  }

  async showSpinWheel() {
    if (this.isSpinWheelVisible()) return;

    this._spinInFlight = false;
    this.resetSpinWheelRotation();

    // Daily-first behavior: force "Watch to Spin" on the first modal open each day.
    const forceDailyFirst = !this.isTodayTurntableDailyFirstShown();
    if (forceDailyFirst) {
      this.markTodayTurntableDailyFirstShown();
      this._turntableNeedsWatch = true;
    }

    this.setSpinWheelBottomButton({
      label: this.getSpinWheelBottomButtonLabel(forceDailyFirst),
      disabled: false,
    });

    try {
      await this.config.onSpinWheelOpen();
    } catch (_) {}

    this.updateSpinWheelSubtitle();
    this.setSpinWheelVisible(true);
  }

  hideSpinWheel() {
    this.setSpinWheelVisible(false);
  }

  async spinWheel() {
    if (this._spinInFlight) return;
    if (this.currentSpinAvailable <= 0) {
      if (this.config.isDailyAdLimitReached?.()) {
        const message = this.config.getDailyAdLimitMessage?.() || "Daily ad watch limit reached";
        this.showToast(message, "warning");
        this.refreshAdTaskStats();
        return;
      }
      // Safety fallback: no spin chances locally, go back to watch mode.
      this._turntableNeedsWatch = true;
      this._waitingAdForSpin = true;
      this.setSpinWheelBottomButton({ label: "Watch to Spin Again", disabled: true });
      this.config.onWatchAdClick();
      return;
    }
    this._spinInFlight = true;
    const prizePoolAtSpinStart = this.spinPrizePool.slice();
    this.setSpinWheelBottomButton({ disabled: true });
    let prize = 0;
    let refreshAfterSpin = null;
    try {
      const result = await this.config.onSpinRequest();
      if (!result?.ok) {
        this._spinInFlight = false;
        return;
      }
      prize = Number(result.coin ?? 0);
      if (typeof result.refreshAfterSpin === "function") {
        refreshAfterSpin = result.refreshAfterSpin;
      }
    } catch (_) {
      this._spinInFlight = false;
      return;
    }
    this.consumeSpinChance(1);
    this.spinPrizePool = prizePoolAtSpinStart;
    const idx = this._sectorIndexForPrize(prize);
    const sectorDeg = 360 / prizePoolAtSpinStart.length;
    // Always stop inside a sector (never on separator lines).
    const safeMarginDeg = 4;
    const maxOffsetDeg = Math.max(0, sectorDeg / 2 - safeMarginDeg);
    const randomOffsetDeg = (Math.random() * 2 - 1) * maxOffsetDeg;
    const targetDeg = 360 - (idx * sectorDeg + sectorDeg / 2 + randomOffsetDeg);
    const currentDeg = ((this.spinRotation % 360) + 360) % 360;
    const normalizedTargetDeg = ((targetDeg % 360) + 360) % 360;
    let deltaDeg = (normalizedTargetDeg - currentDeg + 360) % 360;
    if (deltaDeg < 1) deltaDeg += 360;
    this.spinRotation += 1800 + deltaDeg;
    if (this.elements.spinWheelDisk) {
      this.elements.spinWheelDisk.style.transform = `rotate(${this.spinRotation}deg)`;
    }

    if (this.elements.btnSpinEntry) {
      this.elements.btnSpinEntry.disabled = false;
      this.elements.btnSpinEntry.classList.remove("is-completed");
    }
    const disk = this.elements.spinWheelDisk;
    let finished = false;
    const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
    const startAt = now();
    const minRewardMs = 1550;
    let rewardTimer = null;
    const finish = () => {
      if (finished) return;
      const elapsed = now() - startAt;
      if (elapsed < minRewardMs) {
        const remaining = minRewardMs - elapsed;
        if (rewardTimer) return;
        rewardTimer = setTimeout(() => {
          rewardTimer = null;
          finish();
        }, remaining);
        return;
      }
      finished = true;
      this.showSpinRewardDialog(prize);
      if (refreshAfterSpin) {
        refreshAfterSpin().catch(() => {});
      }
      this._spinInFlight = false;
    };

    // Prefer transitionend so reward modal is shown after wheel animation completes.
    if (disk && typeof disk.addEventListener === "function") {
      const onEnd = (e) => {
        // Only handle transform transition completion.
        if (!e || e.propertyName !== "transform") return;
        disk.removeEventListener("transitionend", onEnd);
        finish();
      };
      disk.addEventListener("transitionend", onEnd);
      // Fallback in case transitionend doesn't fire in some WebViews.
      setTimeout(() => {
        disk.removeEventListener("transitionend", onEnd);
        finish();
      }, 1850);
    } else {
      finish();
    }
  }

  showSpinRewardDialog(prize) {
    if (this.elements.spinRewardCoins) {
      this.elements.spinRewardCoins.textContent = `+${Number(prize || 0)}`;
    }
    if (this.elements.spinRewardModal) {
      this.elements.spinRewardModal.style.display = "flex";
    }
  }

  hideSpinRewardDialog() {
    if (this.elements.spinRewardModal) {
      this.elements.spinRewardModal.style.display = "none";
    }
  }

  /**
   * 用 user_info.user_id 渲染到 Gold Member 上方
   */
  updateUserDisplay(userId) {
    if (!this.elements.userGreeting) return;
    this.elements.userGreeting.textContent = userId != null && userId !== "" ? String(userId) : "";
  }

  /**
   * 显示 Toast
   */
  showToast(message, type = "info") {
    if (!this.elements.toast) return;

    const containsCJK = /[\u4e00-\u9fff]/.test(String(message || ""));
    const fallbackByType = {
      success: "Done.",
      error: "Something went wrong. Please try again.",
      warning: "Please try again.",
      info: "Please wait...",
    };
    const safeText = containsCJK ? (fallbackByType[type] || "Please try again.") : String(message ?? "");

    this.elements.toast.textContent = safeText;
    this.elements.toast.className = `toast ${type}`;
    this.elements.toast.style.display = "block";
    setTimeout(() => {
      this.elements.toast.style.display = "none";
    }, 2000);
  }

  /**
   * 显示签到成功弹框（三处数据来自服务端）
   * 1. + N Coins：checkin 接口返回的 coinFromCheckin
   * 2. get N extra coins：info 今日签到项的 video_coin
   * 3. Get Nx Extra Coins：今日 video_coin/coin 取整倍数
   * @param {{ coinFromCheckin?: number, video_coin?: number, multiplier?: number, coin?: number, compactMode?: boolean, alreadyChecked?: boolean }} reward
   */
  showSigninDialog(reward) {
    const coinFromCheckin = reward?.coinFromCheckin ?? reward?.coin ?? 0;
    const video_coin = reward?.video_coin ?? 0;
    const multiplier = reward?.multiplier ?? 0;
    const alreadyChecked = !!reward?.alreadyChecked;

    if (this.elements.signinDialogCelebration) {
      this.elements.signinDialogCelebration.style.display = "";
    }
    if (this.elements.signinDialogTitle) {
      this.elements.signinDialogTitle.style.display = "";
      this.elements.signinDialogTitle.classList.toggle("signin-dialog-title--muted", alreadyChecked);
      this.elements.signinDialogTitle.textContent = alreadyChecked ? "You have checked in" : "Check-in Successful!";
    }
    if (this.elements.signinDialogBaseCoinsWrap) {
      this.elements.signinDialogBaseCoinsWrap.style.display = "";
    }

    if (this.elements.signinDialogBaseCoins) {
      this.elements.signinDialogBaseCoins.textContent = alreadyChecked
        ? `You have earned ${coinFromCheckin} Coins`
        : `+${coinFromCheckin} Coins`;
      this.elements.signinDialogBaseCoins.classList.toggle("signin-dialog-base-coins--muted", alreadyChecked);
    }
    if (this.elements.signinDialogVideoCoin) {
      this.elements.signinDialogVideoCoin.textContent = `${video_coin}`;
    }
    if (this.elements.signinDialogMultiplier) {
      this.elements.signinDialogMultiplier.textContent = `${multiplier}`;
    }
    if (this.elements.signinDialog) {
      this.elements.signinDialog.style.display = "flex";
    }
    this.updateSigninDialogVideoButtonState();
  }

  /**
   * 隐藏签到成功弹框
   */
  hideSigninDialog() {
    if (this.elements.signinDialog) {
      this.elements.signinDialog.style.display = "none";
    }
  }

  /**
   * 根据后端签到 detail 渲染 7 天签到卡片
   * 未获取到数据时天数、金币均用缺省值 0；已签到展示与 pill 按 continuous_days
   * @param {{ continuous_days: number, super_reward_day?: number, days: Array<{ day: number, coin: number, video_coin: number, current: boolean, received: boolean, video_received: boolean }> }} detail
   */
  updateCheckin(detail) {
    const fingerprint = detail
      ? JSON.stringify({
          continuous_days: detail.continuous_days,
          days: detail.days,
        })
      : "empty";
    if (fingerprint === this._lastCheckinFingerprint) return;
    this._lastCheckinFingerprint = fingerprint;

    const dailyCheckinSection = this.elements.dailyCheckinSection || document.getElementById("tc-daily-checkin-section");
    if (dailyCheckinSection) {
      dailyCheckinSection.style.display = detail ? "" : "none";
    }
    const continuousDays = (detail && typeof detail.continuous_days === "number") ? detail.continuous_days : 0;
    const pill = this.elements.checkinPill;
    if (pill) {
      pill.textContent = `${continuousDays}/7 Days`;
    }

    const container = this.elements.checkinDaysContainer;
    if (!container) return;

    if (!detail || !Array.isArray(detail.days) || detail.days.length === 0) {
      container.innerHTML = [1, 2, 3, 4, 5, 6, 7].map((day) => {
        const isDay7 = day === 7;
        const dayClass = isDay7 ? "tc-checkin-day tc-checkin-day--super" : "tc-checkin-day";
        const labelClass = isDay7 ? "tc-checkin-label tc-checkin-label--super" : "tc-checkin-label";
        const dotContent = isDay7
          ? `<div class="tc-checkin-dot tc-checkin-dot--super"><img src="${assetUrl("icons/card_giftcard.svg")}" alt="gift" class="tc-checkin-super-icon-img"><span class="tc-checkin-super-reward">+0</span></div>`
          : `<div class="tc-checkin-dot tc-checkin-dot--reward">+0</div>`;
        return `<div class="${dayClass}" data-day="${day}">${dotContent}<span class="${labelClass}">Day ${day}</span></div>`;
      }).join("");
      if (this.elements.signinTimerBtn) {
        this.elements.signinTimerBtn.disabled = true;
        this.elements.signinTimerBtn.classList.remove("tc-secondary-btn", "is-completed");
        const span = this.elements.signinTimerBtn.querySelector("span");
        if (span) span.textContent = "Check-in Now";
      }
      this._signinVideoCompleted = false;
      return;
    }

    const superReward = detail.days[6]?.coin ?? 0;
    const daysList = detail.days.slice(0, 7);

    container.innerHTML = daysList
      .map((d, idx) => {
        const isDay7 = d.day === 7 || idx === 6;
        const isDone = d.day <= continuousDays;
        let dotContent = "";
        let dayClass = "tc-checkin-day";
        let labelClass = "tc-checkin-label";

        if (isDay7) {
          dayClass += " tc-checkin-day--super";
          labelClass += " tc-checkin-label--super";
          const amount = isDone ? d.coin : superReward;
          dotContent = `<div class="tc-checkin-dot tc-checkin-dot--super">
            <img src="${assetUrl("icons/card_giftcard.svg")}" alt="gift" class="tc-checkin-super-icon-img">
            <span class="tc-checkin-super-reward">+${amount}</span>
          </div>`;
        } else if (isDone) {
          dayClass += " tc-checkin-day--done";
          dotContent = `<div class="tc-checkin-dot"><span>✓</span><span>+${d.coin}</span></div>`;
        } else {
          dotContent = `<div class="tc-checkin-dot tc-checkin-dot--reward">+${d.coin}</div>`;
        }

        return `<div class="${dayClass}" data-day="${d.day}">${dotContent}<span class="${labelClass}">Day ${d.day}</span></div>`;
      })
      .join("");

    const signinBtn = this.elements.signinTimerBtn;
    if (signinBtn) {
      const today = daysList.find((d) => d.current === true);
      const received = !!today?.received;
      const videoReceived = !!today?.video_received;
      this._signinVideoCompleted = videoReceived;
      const allCompleted = received && videoReceived;
      const canCheckin = !allCompleted;
      signinBtn.disabled = !canCheckin;
      if (allCompleted) {
        // Use the exact same completed style as daily video task button
        signinBtn.classList.add("tc-secondary-btn", "is-completed");
      } else {
        signinBtn.classList.remove("tc-secondary-btn", "is-completed");
      }
      const span = signinBtn.querySelector("span");
      if (span) span.textContent = canCheckin ? "Check-in Now" : "Completed";
    }
    this.updateSigninDialogVideoButtonState();
  }

  updateSigninDialogVideoButtonState() {
    if (!this.elements.signinDialogWatchBtn) return;
    this.elements.signinDialogWatchBtn.disabled = this._signinVideoCompleted;
    this.elements.signinDialogWatchBtn.classList.toggle("is-completed", this._signinVideoCompleted);
    if (this._signinVideoCompleted) {
      this.elements.signinDialogWatchBtn.textContent = "Completed";
    } else if (!this.elements.signinDialogWatchBtn.querySelector(".signin-dialog-watch-icon")) {
      this.elements.signinDialogWatchBtn.innerHTML = `
        <img src="${assetUrl("icons/play_circle.svg")}" alt="" class="signin-dialog-watch-icon" width="24" height="24">
        <span>Get <span id="signinDialogMultiplier">${this.elements.signinDialogMultiplier?.textContent || "0"}</span>x Extra Coins (Watch Video)</span>
      `;
      this.elements.signinDialogMultiplier = document.getElementById("signinDialogMultiplier");
    }
  }

  markSigninVideoCompleted() {
    this._signinVideoCompleted = true;
    this.setSigninWatchLoading(false);
    this.updateSigninDialogVideoButtonState();
  }

  isSigninVideoCompleted() {
    return this._signinVideoCompleted;
  }

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
        if (this.elements.signinTimerBtn.disabled) return;
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
  }

  /**
   * 设置签到弹框“看视频”按钮 loading/禁用状态（防连点）
   */
  setSigninWatchLoading(loading) {
    if (!this.elements.signinDialogWatchBtn) return;
    if (!loading && this._signinVideoCompleted) {
      this.updateSigninDialogVideoButtonState();
      return;
    }
    this.elements.signinDialogWatchBtn.disabled = !!loading;
    if (loading) {
      this.elements.signinDialogWatchBtn.classList.add("tc-signin-watch-loading");
    } else {
      this.elements.signinDialogWatchBtn.classList.remove("tc-signin-watch-loading");
    }
  }
}
