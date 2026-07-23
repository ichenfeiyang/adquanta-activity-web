import { showToast } from "./activity-alert-ui.js";
import { assetUrl } from "./asset-url.js";
import { t } from "./i18n/activity-locale.js";

function clearTimer(timer) {
  if (timer) window.clearInterval(timer);
}

const coinRainRecoveryStorageKey = "activity-center:coin-rain-recovery";

function readCoinRainRecovery() {
  try {
    const value = JSON.parse(globalThis.sessionStorage?.getItem(coinRainRecoveryStorageKey) || "null");
    if (!value || typeof value.sessionId !== "string" || !Number.isSafeInteger(value.clicked) || value.clicked < 0) return null;
    return value;
  } catch {
    return null;
  }
}

function writeCoinRainRecovery(session) {
  try {
    globalThis.sessionStorage?.setItem(coinRainRecoveryStorageKey, JSON.stringify({
      sessionId: session.sessionId,
      clicked: session.clicked,
      deadlineAt: session.deadlineAt,
    }));
  } catch {
    // Storage can be disabled in embedded browsers. The in-memory retry still works.
  }
}

function clearCoinRainRecovery() {
  try {
    globalThis.sessionStorage?.removeItem(coinRainRecoveryStorageKey);
  } catch {
    // Best-effort cleanup only.
  }
}

export const coinRainUiMixin = {
  bindCoinRainEvents() {
    this.elements.coinRainEntry?.addEventListener("click", () => this.config.onCoinRainEntryClick(this._coinRainStatus));
    this.elements.coinRainLeave?.addEventListener("click", () => this.leaveCoinRain());
    this.elements.coinRainLeaveClose?.addEventListener("click", () => this.hideCoinRainLeaveDialog());
    this.elements.coinRainContinue?.addEventListener("click", () => this.hideCoinRainLeaveDialog());
    this.elements.coinRainConfirmLeave?.addEventListener("click", () => this.abandonCoinRainImmediately());
    this.elements.coinRainJoinedClose?.addEventListener("click", () => this.hideCoinRainAlreadyJoined());
    this.elements.coinRainJoinedOk?.addEventListener("click", () => this.hideCoinRainAlreadyJoined());
    this.elements.coinRainClaim?.addEventListener("click", () => this.hideCoinRainResult());
    this.elements.coinRainResultClose?.addEventListener("click", () => this.hideCoinRainResult());
    this.elements.coinRainWatchAd?.addEventListener("click", () => {
      if (this.elements.coinRainWatchAd.disabled) return;
      this.config.onCoinRainWatchAd(this._coinRainStatus);
    });
  },

  hasActiveCoinRainSession() {
    return !!this._coinRainSession;
  },

  hasPendingCoinRainSettlement() {
    return !!this._coinRainSession?.settlementPending;
  },

  updateCoinRainGameProgress(remainingMs, durationMs) {
    const progress = this.elements.coinRainGameProgress;
    if (!progress) return;
    const duration = Math.max(1, Number(durationMs) || 1);
    const remaining = Math.min(duration, Math.max(0, Number(remainingMs) || 0));
    progress.style.width = `${(remaining / duration) * 100}%`;
  },

  updateCoinRainCountdownMax(displayMaxCoin) {
    const el = this.elements.coinRainCountdownMax;
    if (!el) return;
    const count = Math.max(0, Math.floor(Number(displayMaxCoin) || 0));
    const label = t("center.coinRainUpTo", { count });
    const token = String(count);
    const idx = label.indexOf(token);
    if (idx < 0 || typeof document === "undefined" || typeof document.createElement !== "function") {
      el.textContent = label;
      return;
    }
    const mark = document.createElement("em");
    mark.textContent = token;
    if (typeof el.replaceChildren === "function") {
      el.replaceChildren(document.createTextNode(label.slice(0, idx)), mark, document.createTextNode(label.slice(idx + token.length)));
      return;
    }
    el.textContent = label;
  },

  setCoinRainCountdownValue(value) {
    const el = this.elements.coinRainCountdownValue;
    if (!el) return;
    el.textContent = String(value);
    if (!el.classList) return;
    el.classList.remove("is-tick");
    void el.offsetWidth;
    el.classList.add("is-tick");
  },

  updateCoinRainMultiplier(clickedCount) {
    const value = Math.max(0, Math.floor(Number(clickedCount) || 0));
    const label = this.elements.coinRainMultiplierValue;
    const badge = this.elements.coinRainMultiplier;
    if (label) label.textContent = `x${value}`;
    if (!badge?.classList) return;
    const digits = String(value).length;
    badge.classList.toggle("is-wide", digits >= 2);
    badge.classList.toggle("is-wider", digits >= 3);
    badge.classList.remove("is-bump");
    // Retrigger bump animation on each successful click.
    if (value > 0) {
      void badge.offsetWidth;
      badge.classList.add("is-bump");
    }
  },

  updateCoinRain(status) {
    this._coinRainStatus = status;
    const section = this.elements.coinRainSection;
    const entry = this.elements.coinRainEntry;
    const action = this.elements.coinRainEntryAction;
    if (!section || !entry || !action) return;
    if (!status?.enabled) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";
    const displayMaxCoin = Number(status.display_max_coin);
    if (!Number.isSafeInteger(displayMaxCoin) || displayMaxCoin <= 0) {
      section.style.display = "none";
      return;
    }
    if (this.elements.coinRainDesc) this.elements.coinRainDesc.textContent = t("center.coinRainDescMax", { count: displayMaxCoin });
    const completed = status.state === "completed" || status.state === "abandoned" || status.state === "expired";
    entry.classList.toggle("is-completed", completed);
    if (status.state === "boost_available") action.textContent = t("center.coinRainBoost");
    else if (status.state === "settle_pending") action.textContent = t("center.coinRainClaim");
    else action.textContent = completed ? t("center.coinRainCompleted") : t("center.coinRainPlay");
  },

  clearCoinRainLocalTimers() {
    clearTimer(this._coinRainCountdownTimer);
    clearTimer(this._coinRainSpawnTimer);
    clearTimer(this._coinRainGameTimer);
    this._coinRainCountdownTimer = this._coinRainSpawnTimer = this._coinRainGameTimer = 0;
  },

  startCoinRainSession(result, { resume = false } = {}) {
    if (!result?.session_id || !this.elements.coinRainOverlay) return;
    const baseMaxCoin = Number(result.base_max_coin);
    const displayMaxCoin = Number(result.display_max_coin ?? this._coinRainStatus?.display_max_coin);
    if (!Number.isSafeInteger(baseMaxCoin) || baseMaxCoin <= 0 || !Number.isSafeInteger(displayMaxCoin) || displayMaxCoin < baseMaxCoin) {
      showToast(t("center.coinRainUnavailable"), "error");
      return;
    }
    // Guard against double-start stacking timers/overlays.
    if (this._coinRainSession) {
      this.clearCoinRainLocalTimers();
      this.elements.coinRainStage?.replaceChildren();
    }
    const recovery = readCoinRainRecovery();
    const recoveredClicked = resume && recovery?.sessionId === String(result.session_id) ? recovery.clicked : 0;
    this._coinRainSession = {
      sessionId: String(result.session_id),
      baseMaxCoin,
      displayMaxCoin,
      duration: Math.max(10, Number(result.duration_seconds ?? 30) || 30),
      clicked: Math.min(baseMaxCoin, recoveredClicked),
      running: false,
      paused: false,
      settling: false,
      settlementPending: false,
      pauseStartedAt: 0,
      endAt: 0,
      deadlineAt: Number.isFinite(Date.parse(result.deadline_at)) ? Date.parse(result.deadline_at) : 0,
    };
    this.elements.coinRainCollected.textContent = String(this._coinRainSession.clicked);
    this.updateCoinRainMultiplier(this._coinRainSession.clicked);
    this.elements.coinRainTime.textContent = `00:${String(this._coinRainSession.duration).padStart(2, "0")}`;
    this.updateCoinRainGameProgress(this._coinRainSession.duration * 1000, this._coinRainSession.duration * 1000);
    if (this.elements.coinRainCountdownMax) {
      this.updateCoinRainCountdownMax(displayMaxCoin);
    }
    this.elements.coinRainStage.replaceChildren();
    this.elements.coinRainCountdown.style.display = "flex";
    this.elements.coinRainOverlay.classList.add("is-countdown");
    this.elements.coinRainOverlay.classList.remove("is-paused");
    this.hideCoinRainLeaveDialog(false);
    this.elements.coinRainOverlay.style.display = "block";
    writeCoinRainRecovery(this._coinRainSession);
    if (typeof document !== "undefined" && document.body) document.body.style.overflow = "hidden";
    if (!this._coinRainVisibilityHandler) {
      this._coinRainVisibilityHandler = () => {
        // PRD: leaving/background during prep or play should confirm via Leave dialog.
        if (document.hidden && this._coinRainSession) this.leaveCoinRain();
      };
      document.addEventListener("visibilitychange", this._coinRainVisibilityHandler);
    }
    if (resume) {
      this.elements.coinRainCountdown.style.display = "none";
      this.runCoinRain();
      return;
    }
    let count = 3;
    this.setCoinRainCountdownValue(count);
    this.clearCoinRainLocalTimers();
    this._coinRainCountdownTimer = window.setInterval(() => {
      if (this._coinRainSession?.paused) return;
      count -= 1;
      if (count > 0) {
        this.setCoinRainCountdownValue(count);
        return;
      }
      clearTimer(this._coinRainCountdownTimer);
      this._coinRainCountdownTimer = 0;
      this.elements.coinRainCountdown.style.display = "none";
      this.runCoinRain();
    }, 1000);
  },

  restoreCoinRainSettlement(result) {
    const recovery = readCoinRainRecovery();
    const sessionId = String(result?.session_id || "");
    const baseMaxCoin = Number(result?.base_max_coin);
    if (!sessionId || recovery?.sessionId !== sessionId || !Number.isSafeInteger(baseMaxCoin) || baseMaxCoin <= 0) return false;
    this._coinRainSession = {
      sessionId,
      baseMaxCoin,
      displayMaxCoin: Number(result.display_max_coin) || baseMaxCoin,
      duration: Math.max(10, Number(result.duration_seconds ?? 30) || 30),
      clicked: Math.min(baseMaxCoin, recovery.clicked),
      running: false,
      paused: false,
      settling: false,
      settlementPending: true,
      pauseStartedAt: 0,
      endAt: Number(recovery.deadlineAt) || 0,
      deadlineAt: Number(recovery.deadlineAt) || 0,
    };
    return true;
  },

  runCoinRain() {
    const session = this._coinRainSession;
    if (!session || session.running) return;
    session.running = true;
    const durationMs = session.duration * 1000;
    session.endAt = session.deadlineAt > 0 ? session.deadlineAt : Date.now() + durationMs;
    this.elements.coinRainOverlay.classList.remove("is-countdown");
    const coinFace = assetUrl("icons/coin-rain-gold-coin.svg");
    const sparkArt = assetUrl("images/coin-rain-sparkle.png");
    const maxOnStage = 14;
    // Dense enough for design feel, but capped for mid-range phones.
    const spawnEvery = Math.max(95, Math.min(160, Math.floor(durationMs / 240)));
    const spawnCoin = () => {
      if (!session.running || session.paused) return;
      const stage = this.elements.coinRainStage;
      if (!stage) return;
      if (stage.childElementCount >= maxOnStage) return;
      const size = 58 + Math.floor(Math.random() * 42);
      const coin = document.createElement("button");
      coin.type = "button";
      coin.className = "tc-coin-rain-coin";
      coin.innerHTML = `
        <span class="tc-coin-rain-coin-trail" aria-hidden="true"></span>
        <img class="tc-coin-rain-coin-face" src="${coinFace}" alt="">
        <img class="tc-coin-rain-coin-spark tc-coin-rain-coin-spark--a" src="${sparkArt}" alt="" aria-hidden="true">
        <img class="tc-coin-rain-coin-spark tc-coin-rain-coin-spark--b" src="${sparkArt}" alt="" aria-hidden="true">
      `;
      coin.style.left = `${3 + Math.random() * 86}%`;
      coin.style.setProperty("--coin-size", `${size}px`);
      coin.style.setProperty("--fall-duration", `${2.6 + Math.random() * 1.7}s`);
      coin.style.setProperty("--coin-drift", `${Math.round((Math.random() - 0.5) * 56)}px`);
      coin.style.setProperty("--coin-spin-duration", `${0.9 + Math.random() * 0.8}s`);
      coin.style.setProperty("--coin-tilt", `${Math.round((Math.random() - 0.5) * 28)}deg`);
      coin.style.setProperty("--spark-delay", `${(-Math.random()).toFixed(2)}s`);
      coin.addEventListener("click", () => {
        if (!session.running || coin.dataset.claimed === "1" || session.clicked >= session.baseMaxCoin) return;
        coin.dataset.claimed = "1";
        session.clicked += 1;
        writeCoinRainRecovery(session);
        this.elements.coinRainCollected.textContent = String(session.clicked);
        this.updateCoinRainMultiplier(session.clicked);
        coin.classList.add("is-claimed");
        window.setTimeout(() => coin.remove(), 160);
      });
      coin.addEventListener("animationend", (event) => {
        if (event.animationName === "tc-coin-rain-fall") coin.remove();
      });
      stage.appendChild(coin);
    };
    spawnCoin();
    spawnCoin();
    this._coinRainSpawnTimer = window.setInterval(spawnCoin, spawnEvery);
    this._coinRainGameTimer = window.setInterval(() => {
      const remaining = Math.max(0, session.endAt - Date.now());
      // Leave dialog freezes spawning/HUD, but the server deadline keeps moving.
      // Auto-settle when time is up so a parked leave cannot burn the +2m grace.
      if (session.paused) {
        if (remaining <= 0) {
          this.hideCoinRainLeaveDialog(false);
          void this.finishCoinRain();
        }
        return;
      }
      this.elements.coinRainTime.textContent = `00:${String(Math.ceil(remaining / 1000)).padStart(2, "0")}`;
      this.updateCoinRainGameProgress(remaining, durationMs);
      if (remaining <= 0) this.finishCoinRain();
    }, 200);
  },

  async finishCoinRain({ retry = false } = {}) {
    const session = this._coinRainSession;
    if (!session || session.settling || (!retry && !session.running)) return;
    session.running = false;
    session.paused = false;
    session.settling = true;
    session.settlementPending = true;
    writeCoinRainRecovery(session);
    this.clearCoinRainLocalTimers();
    this.elements.coinRainStage.replaceChildren();
    this.elements.coinRainOverlay.style.display = "none";
    this.elements.coinRainOverlay.classList.remove("is-countdown");
    if (typeof document !== "undefined" && document.body) document.body.style.overflow = "";
    let result = await this.config.onCoinRainSettle({ sessionId: session.sessionId, clickedCount: session.clicked });
    if (!result?.ok) {
      await new Promise((resolve) => window.setTimeout(resolve, 800));
      result = await this.config.onCoinRainSettle({ sessionId: session.sessionId, clickedCount: session.clicked });
    }
    if (!result?.ok) {
      showToast(result?.message || t("center.coinRainSettleFailed"), "error");
      // Keep the original click count/session ID. The card can retry settlement
      // without reopening the game or submitting a zero-click result.
      session.settling = false;
      return;
    }
    clearCoinRainRecovery();
    this._coinRainSession = null;
    this.showCoinRainResult(result);
  },

  retryCoinRainSettlement() {
    if (!this._coinRainSession?.settlementPending) {
      showToast(t("center.coinRainSettleFailed"), "error");
      return;
    }
    void this.finishCoinRain({ retry: true });
  },

  leaveCoinRain() {
    const session = this._coinRainSession;
    if (!session || session.settling || session.settlementPending) return;
    const leaveDialog = this.elements.coinRainLeaveDialog;
    if (session.paused && leaveDialog?.style?.display === "flex") return;
    session.paused = true;
    session.pauseStartedAt = Date.now();
    this.elements.coinRainOverlay.classList.add("is-paused");
    if (this.elements.coinRainLeaveDesc) {
      this.elements.coinRainLeaveDesc.textContent = session.running
        ? t("center.coinRainLeaveDesc")
        : t("center.coinRainLeaveBeforeStartDesc");
    }
    if (leaveDialog) leaveDialog.style.display = "flex";
  },

  hideCoinRainLeaveDialog(resume = true) {
    if (this.elements.coinRainLeaveDialog) this.elements.coinRainLeaveDialog.style.display = "none";
    this.elements.coinRainOverlay?.classList.remove("is-paused");
    const session = this._coinRainSession;
    if (!resume || !session?.paused) return;
    if (session.endAt > 0 && Date.now() >= session.endAt) {
      session.paused = false;
      session.pauseStartedAt = 0;
      void this.finishCoinRain();
      return;
    }
    session.paused = false;
    session.pauseStartedAt = 0;
  },

  async abandonCoinRainImmediately() {
    const session = this._coinRainSession;
    if (!session || session.settling || session.settlementPending) return;
    // Match the server's settlement admission boundary. A leave confirmed at
    // the end of the game must settle, not discard the locally collected count.
    if (session.endAt > 0 && Date.now() >= session.endAt - 2_000) {
      this.hideCoinRainLeaveDialog(false);
      session.paused = false;
      await this.finishCoinRain();
      return;
    }
    session.running = false;
    this.clearCoinRainLocalTimers();
    this.elements.coinRainStage?.replaceChildren();
    if (this.elements.coinRainOverlay) {
      this.elements.coinRainOverlay.style.display = "none";
      this.elements.coinRainOverlay.classList.remove("is-countdown");
      this.elements.coinRainOverlay.classList.remove("is-paused");
    }
    this.hideCoinRainLeaveDialog(false);
    if (typeof document !== "undefined" && document.body) document.body.style.overflow = "";
    const result = await this.config.onCoinRainAbandon({ sessionId: session.sessionId });
    if (!result?.ok) {
      // Do not erase a valid local settlement if the server has already moved
      // into its final settlement window.
      session.paused = false;
      if (session.endAt > 0 && Date.now() >= session.endAt - 2_000) {
        await this.finishCoinRain();
      } else {
        showToast(result?.message || t("center.coinRainSettleFailed"), "error");
        this.startCoinRainSession({
          session_id: session.sessionId,
          base_max_coin: session.baseMaxCoin,
          display_max_coin: session.displayMaxCoin,
          duration_seconds: session.duration,
          deadline_at: session.deadlineAt ? new Date(session.deadlineAt).toISOString() : null,
        }, { resume: true });
      }
      return;
    }
    clearCoinRainRecovery();
    this._coinRainSession = null;
  },

  setCoinRainResultHero(kind = "reward") {
    const img = this.elements.coinRainResultHeroImg;
    if (!img) return;
    if (kind === "boost-prompt") {
      img.src = assetUrl("images/coin-rain-boost-prompt-art.png");
      img.width = 180;
      img.height = 86;
      return;
    }
    img.src = assetUrl("images/coin-rain-reward-art.png");
    img.width = 210;
    img.height = kind === "boost-success" ? 128 : 112;
  },

  showCoinRainResult(result) {
    this._coinRainStatus = { ...this._coinRainStatus, ...result };
    const baseCoin = Number(result?.base_coin ?? 0) || 0;
    this.elements.coinRainResult.classList.remove("is-boost-prompt", "is-boost-success");
    this.setCoinRainResultHero("reward");
    this.elements.coinRainResultTitle.textContent = baseCoin > 0 ? t("center.coinRainRewardTitle") : t("center.coinRainFinished");
    this.elements.coinRainResultAmount.textContent = `+${baseCoin}`;
    this.elements.coinRainResultAmount.style.display = "";
    this.elements.coinRainResultUnit.style.display = "";
    this.elements.coinRainResultCopy.textContent = baseCoin > 0 ? "" : t("center.coinRainNoCoins");
    this.elements.coinRainResultCopy.style.display = baseCoin > 0 ? "none" : "";
    this.elements.coinRainBoostOffer.style.display = baseCoin > 0 && result?.boost_available === true ? "flex" : "none";
    this.elements.coinRainBoostOfferCopy.textContent = t("center.coinRainGetInstead", { count: baseCoin * 2 });
    this.elements.coinRainWatchAd.style.display = baseCoin > 0 && result?.boost_available === true ? "" : "none";
    this.elements.coinRainWatchAd.textContent = t("center.coinRainWatchAd");
    this.elements.coinRainClaim.textContent = baseCoin > 0 ? t("center.coinRainClaimAmount", { count: baseCoin }) : t("center.coinRainGotIt");
    this.elements.coinRainResult.style.display = "flex";
  },

  showCoinRainBoostPrompt(status) {
    const baseCoin = Number(status?.base_coin ?? 0) || 0;
    this._coinRainStatus = { ...this._coinRainStatus, ...status };
    this.elements.coinRainResult.classList.add("is-boost-prompt");
    this.elements.coinRainResult.classList.remove("is-boost-success");
    this.setCoinRainResultHero("boost-prompt");
    this.elements.coinRainResultTitle.textContent = t("center.coinRainAlreadyGot", { count: baseCoin });
    this.elements.coinRainResultAmount.style.display = "none";
    this.elements.coinRainResultUnit.style.display = "none";
    this.elements.coinRainResultCopy.style.display = "";
    this.elements.coinRainResultCopy.textContent = t("center.coinRainWatchMore", { count: baseCoin });
    this.elements.coinRainBoostOffer.style.display = "none";
    this.elements.coinRainWatchAd.style.display = "";
    this.elements.coinRainWatchAd.disabled = false;
    this.elements.coinRainWatchAd.textContent = t("center.coinRainWatchVideo");
    this.elements.coinRainClaim.textContent = t("center.coinRainLater");
    this.elements.coinRainResult.style.display = "flex";
  },

  showCoinRainAlreadyJoined() {
    if (this.elements.coinRainJoinedDialog) this.elements.coinRainJoinedDialog.style.display = "flex";
  },

  hideCoinRainAlreadyJoined() {
    if (this.elements.coinRainJoinedDialog) this.elements.coinRainJoinedDialog.style.display = "none";
  },

  setCoinRainAdLoading(loading) {
    if (!this.elements.coinRainWatchAd) return;
    this.elements.coinRainWatchAd.disabled = !!loading;
    this.elements.coinRainWatchAd.textContent = loading
      ? t("common.processing")
      : this.elements.coinRainResult?.classList.contains("is-boost-prompt")
        ? t("center.coinRainWatchVideo")
        : t("center.coinRainWatchAd");
  },

  showCoinRainBoostSuccess(result) {
    this.setCoinRainAdLoading(false);
    const totalCoin = Number(result?.base_coin ?? 0) + Number(result?.boost_coin ?? 0);
    this._coinRainStatus = { ...this._coinRainStatus, ...result, state: "completed" };
    this.elements.coinRainResult.classList.remove("is-boost-prompt");
    this.elements.coinRainResult.classList.add("is-boost-success");
    this.setCoinRainResultHero("boost-success");
    this.elements.coinRainResultTitle.textContent = t("center.coinRainBoostSuccess");
    this.elements.coinRainResultAmount.style.display = "";
    this.elements.coinRainResultAmount.textContent = `+${totalCoin}`;
    this.elements.coinRainResultUnit.style.display = "";
    this.elements.coinRainResultCopy.style.display = "none";
    this.elements.coinRainBoostOffer.style.display = "none";
    this.elements.coinRainWatchAd.style.display = "none";
    this.elements.coinRainClaim.textContent = t("center.coinRainGotIt");
    this.elements.coinRainResult.style.display = "flex";
  },

  hideCoinRainResult() {
    if (this.elements.coinRainResult) this.elements.coinRainResult.style.display = "none";
    this.config.onCoinRainResultDismiss?.();
  },

  destroyCoinRain() {
    if (this._coinRainSession) {
      this._coinRainSession.running = false;
      this._coinRainSession = null;
    }
    this.clearCoinRainLocalTimers();
    this.elements.coinRainStage?.replaceChildren();
    if (this.elements.coinRainOverlay) this.elements.coinRainOverlay.style.display = "none";
    this.elements.coinRainOverlay?.classList.remove("is-countdown");
    this.hideCoinRainLeaveDialog(false);
    this.hideCoinRainAlreadyJoined();
    if (typeof document !== "undefined" && document.body) document.body.style.overflow = "";
    if (this._coinRainVisibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this._coinRainVisibilityHandler);
      this._coinRainVisibilityHandler = null;
    }
  },
};
