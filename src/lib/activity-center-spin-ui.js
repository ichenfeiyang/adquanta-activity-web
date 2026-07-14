import { showToast } from "./activity-alert-ui.js";
import { formatLuckySpinDesc, maxRouletteCoin } from "./activity-center-ui-helpers.js";
import {
  adFailedMessage,
  dailyAdLimitMessage,
} from "./activity-messages.js";
import { t } from "./i18n/activity-locale.js";
export const spinUiMixin = {
  isSpinWheelVisible() {
    return this.elements.spinWheelModal?.style.display === "flex";
  },

  resetWatchSpinButton() {
    const btn = this.elements.btnWatchAd;
    if (!btn) return;
    btn.classList.remove("can-claim", "is-completed");
    this.setWatchSpinButtonLabel([
      t("center.watchVideoToSpinLine1"),
      t("center.watchVideoToSpinLine2"),
    ]);
    btn.disabled = false;
  },

  getSpinWheelBottomButtonLabel(forceDailyFirst) {
    if (forceDailyFirst) return t("center.watchToSpin");
    if (this._turntableNeedsWatch) return t("center.watchToSpinAgain");
    return t("center.spinNow");
  },

  setSpinWheelBottomButton({ label, disabled } = {}) {
    const btn = this.elements.spinWheelSpinBtn;
    if (!btn) return;
    if (label !== undefined) btn.textContent = label;
    if (disabled !== undefined) btn.disabled = disabled;
  },

  setSpinWheelVisible(visible) {
    document.body.classList.toggle("tc-spin-wheel-open", visible);
    const modal = this.elements.spinWheelModal;
    if (modal) modal.style.display = visible ? "flex" : "none";
    this.syncBodyScrollLock();
  },

  isSpinRewardVisible() {
    return this.elements.spinRewardModal?.style.display === "flex";
  },

  isScrollLockOverlayOpen() {
    return this.isSpinWheelVisible() || this.isSpinRewardVisible() || this.isNewUserBonusVisible?.();
  },

  syncBodyScrollLock() {
    const shouldLock = this.isScrollLockOverlayOpen();
    if (shouldLock && !this._bodyScrollLocked) {
      this._savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      document.body.style.top = `-${this._savedScrollY}px`;
      document.body.classList.add("tc-scroll-locked");
      this._bodyScrollLocked = true;
      return;
    }
    if (!shouldLock && this._bodyScrollLocked) {
      document.body.classList.remove("tc-scroll-locked");
      document.body.style.top = "";
      window.scrollTo(0, this._savedScrollY || 0);
      this._bodyScrollLocked = false;
    }
  },

  closeSpinRewardDialog() {
    this.hideSpinRewardDialog();
    this.enterSpinWatchAgainMode();
  },

  enterSpinWatchAgainMode() {
    this._turntableNeedsWatch = true;
    this.setSpinWheelBottomButton({ label: t("center.watchToSpinAgain"), disabled: false });
    this.updateSpinWheelSubtitle();
  },

  getTodayDateKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  },

  getSpinWheelSubtitleText() {
    if (this._turntableNeedsWatch) {
      return t("center.spinSubtitleWatch");
    }
    return t("center.spinSubtitleSpin");
  },

  updateSpinWheelSubtitle() {
    if (!this.elements.spinWheelSubtitle) return;
    this.elements.spinWheelSubtitle.textContent = this.getSpinWheelSubtitleText();
  },

  setWatchSpinButtonLabel(label) {
    const btn = this.elements.btnWatchAd;
    if (!btn) return;
    if (Array.isArray(label)) {
      btn.replaceChildren(
        ...label.map((text) => {
          const span = document.createElement("span");
          span.textContent = text;
          return span;
        }),
      );
      return;
    }
    const span = btn.querySelector("span");
    if (span) {
      span.textContent = label;
      return;
    }
    btn.textContent = label;
  },

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
  },

  getTodaySpinAvailableKey() {
    return `activity_turntable_available_${this.getTodayDateKey()}`;
  },

  getTodayTurntableDailyFirstShownKey() {
    return `activity_turntable_daily_first_shown_${this.getTodayDateKey()}`;
  },

  isTodayTurntableDailyFirstShown() {
    try {
      return localStorage.getItem(this.getTodayTurntableDailyFirstShownKey()) === "1";
    } catch (_) {
      return false;
    }
  },

  markTodayTurntableDailyFirstShown() {
    try {
      localStorage.setItem(this.getTodayTurntableDailyFirstShownKey(), "1");
    } catch (_) {}
  },

  loadSpinAvailableState() {
    try {
      const raw = localStorage.getItem(this.getTodaySpinAvailableKey()) || "0";
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch (_) {
      return 0;
    }
  },

  saveSpinAvailableState() {
    try {
      localStorage.setItem(this.getTodaySpinAvailableKey(), String(this.currentSpinAvailable));
    } catch (_) {}
  },

  clampSpinCountByLimit() {
    const limit = Number(this.dailySpinLimit || 0);
    if (limit >= 0) {
      this.currentSpinAvailable = Math.min(this.currentSpinAvailable, limit);
    }
    this.currentSpinAvailable = Math.max(0, Math.floor(this.currentSpinAvailable));
    this.saveSpinAvailableState();
  },

  addSpinChance(delta = 1) {
    if (this.config.isDailyAdLimitReached?.()) return;
    const inc = Number(delta);
    if (!Number.isFinite(inc) || inc <= 0) return;
    this.currentSpinAvailable += Math.floor(inc);
    this.clampSpinCountByLimit();
  },

  consumeSpinChance(delta = 1) {
    const dec = Number(delta);
    if (!Number.isFinite(dec) || dec <= 0) return;
    this.currentSpinAvailable = Math.max(0, this.currentSpinAvailable - Math.floor(dec));
    this.saveSpinAvailableState();
  },

  normalizeRouletteCoins(rouletteCoins) {
    if (!Array.isArray(rouletteCoins) || rouletteCoins.length === 0) return null;
    const list = rouletteCoins.slice(0, 8).map((v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : 0;
    });
    if (!list.some((n) => n > 0)) return null;
    while (list.length < 8) list.push(0);
    return list;
  },

  renderTurntableFromCoins(rouletteCoins = []) {
    const nextPool = this.normalizeRouletteCoins(rouletteCoins);
    if (!nextPool) return;
    this.spinPrizePool = nextPool;
    const poolKey = this.spinPrizePool.join(",");
    if (poolKey === this._lastSpinPoolKey) return;
    this._lastSpinPoolKey = poolKey;
    for (let i = 0; i < 8; i += 1) {
      const el = this.spinLabels[i];
      if (el) el.textContent = String(this.spinPrizePool[i] ?? 0);
      const cardEl = this.spinCardLabels?.[i];
      if (cardEl) cardEl.textContent = String(this.spinPrizePool[i] ?? 0);
    }
  },

  syncTurntableFromTask(task) {
    if (!task) return;
    const limit = Number(task.daily_limit ?? this.dailySpinLimit);
    if (Number.isFinite(limit) && limit > 0) this.dailySpinLimit = limit;
    const coins = task?.roulette?.roulette_coins;
    this.renderTurntableFromCoins(coins);
    this.clampSpinCountByLimit();
  },

  syncSpinAvailableFromTask(task) {
    if (!task) return;
    const completed = Number(task.completed ?? 0);
    this.currentSpinAvailable = Math.min(this.currentSpinAvailable, completed);
    this.saveSpinAvailableState();
  },

  setAdTaskDescription(rouletteCoins) {
    const coins = this.normalizeRouletteCoins(rouletteCoins) || this.spinPrizePool;
    const maxCoin = maxRouletteCoin(coins);
    if (this.elements.adMaxCoin) {
      this.elements.adMaxCoin.textContent = t("center.luckySpinMaxCoins", { maxCoin });
    }
    if (this.elements.adTaskDesc && !this.elements.adMaxCoin) {
      this.elements.adTaskDesc.textContent = formatLuckySpinDesc(maxCoin);
    }
  },

  syncAdTaskProgressFromTask(task) {
    if (!task) return;
    const roulette = task.roulette;
    const earnedPool = typeof roulette?.earned_coins === "number" ? roulette.earned_coins : null;
    const dailyLimit = Number(task.daily_limit ?? this.dailySpinLimit);
    const remainCount = task.remain_count != null ? Number(task.remain_count) : null;
    this.renderAdTaskProgress(
      Number(task.completed ?? 0),
      earnedPool,
      task.reward ?? 0,
      dailyLimit,
      remainCount,
      Number(roulette?.total_coins ?? 0),
    );
  },

  renderAdTaskProgress(completed, earnedPool, taskReward = 0, dailyLimit = 0, remainCount = null, totalCoinLimit = 0) {
    const limit = dailyLimit > 0 ? dailyLimit : this.dailySpinLimit;
    let used;
    if (remainCount != null && limit > 0) {
      used = Math.max(0, Math.min(limit, limit - Number(remainCount)));
    } else {
      used = Math.max(0, Number(completed) - Number(this.currentSpinAvailable || 0));
    }
    if (this.elements.adProgressVideos) {
      const spinsLeft = remainCount != null && Number.isFinite(remainCount)
        ? Math.max(0, Number(remainCount))
        : Math.max(0, limit - used);
      this.elements.adProgressVideos.textContent = t("center.spinChanceProgress", {
        remain: spinsLeft,
        limit,
      });
    }
    if (this.elements.adProgressBarFill) {
      const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
      this.elements.adProgressBarFill.style.width = `${pct}%`;
    }
    if (this.elements.adEarnedText) {
      const earnedCoins = earnedPool != null ? earnedPool : completed * taskReward;
      const totalCoins = Number(totalCoinLimit ?? 0);
      this.elements.adEarnedText.textContent = t("center.coinLimitProgress", {
        earned: Math.max(0, Number(earnedCoins) || 0),
        total: totalCoins > 0 ? totalCoins : Math.max(0, Number(earnedCoins) || 0),
      });
    }
  },

  refreshAdTaskStats() {
    const task = this.config.getAdTaskStatus?.();
    if (!task) return;
    this.syncAdTaskProgressFromTask(task);
  },

  isWaitingAdForSpin() {
    return this._waitingAdForSpin;
  },

  async handleRewardAdCompletedForSpin() {
    if (!this._waitingAdForSpin) return;
    this._waitingAdForSpin = false;
    if (this.config.isDailyAdLimitReached?.()) {
      const message = this.config.getDailyAdLimitMessage?.() || dailyAdLimitMessage();
      this.handleRewardAdFailedForSpin(message);
      this.refreshAdTaskStats();
      return;
    }
    this.addSpinChance(1);
    // After watching ad successfully, user must click Spin Now manually.
    this._turntableNeedsWatch = false;
    this.setSpinWheelBottomButton({ label: t("center.spinNow"), disabled: false });
    this.updateSpinWheelSubtitle();
  },

  handleRewardAdFailedForSpin(message = adFailedMessage()) {
    this._waitingAdForSpin = false;
    this.enterSpinWatchAgainMode();
    showToast(message, "warning");
  },

  handleSpinWheelBottomClick() {
    const btn = this.elements.spinWheelSpinBtn;
    if (btn?.disabled) return;

    if (this._turntableNeedsWatch) {
      if (this._waitingAdForSpin) return;
      if (this.config.isDailyAdLimitReached?.()) {
        const message = this.config.getDailyAdLimitMessage?.() || dailyAdLimitMessage();
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
  },

  resetSpinWheelRotation() {
    this.spinRotation = 0;
    const disk = this.elements.spinWheelDisk;
    if (!disk) return;
    disk.style.transition = "none";
    disk.style.transform = "rotate(0deg)";
    void disk.offsetWidth;
    disk.style.transition = "";
  },

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
  },

  hideSpinWheel() {
    this.setSpinWheelVisible(false);
  },

  async spinWheel() {
    if (this._spinInFlight) return;
    if (this.currentSpinAvailable <= 0) {
      if (this.config.isDailyAdLimitReached?.()) {
        const message = this.config.getDailyAdLimitMessage?.() || dailyAdLimitMessage();
        showToast(message, "warning");
        this.refreshAdTaskStats();
        return;
      }
      // Safety fallback: no spin chances locally, go back to watch mode.
      this._turntableNeedsWatch = true;
      this._waitingAdForSpin = true;
      this.setSpinWheelBottomButton({ label: t("center.watchToSpinAgain"), disabled: true });
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
  },

  showSpinRewardDialog(prize) {
    if (this.elements.spinRewardCoins) {
      this.elements.spinRewardCoins.textContent = `+${Number(prize || 0)}`;
    }
    if (this.elements.spinRewardModal) {
      this.elements.spinRewardModal.style.display = "flex";
    }
    this.syncBodyScrollLock();
  },

  hideSpinRewardDialog() {
    if (this.elements.spinRewardModal) {
      this.elements.spinRewardModal.style.display = "none";
    }
    this.syncBodyScrollLock();
  },

};
