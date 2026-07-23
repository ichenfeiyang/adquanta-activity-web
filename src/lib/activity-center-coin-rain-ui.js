import { showToast } from "./activity-alert-ui.js";
import { assetUrl } from "./asset-url.js";
import { t } from "./i18n/activity-locale.js";

function clearTimer(timer) {
  if (timer) window.clearInterval(timer);
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
    const displayMaxCoin = Number(status.display_max_coin ?? 400) || 400;
    const earnedCoin = Math.min(displayMaxCoin, Math.max(0, Number(status.base_coin ?? 0) + Number(status.boost_coin ?? 0)));
    if (this.elements.coinRainDesc) this.elements.coinRainDesc.textContent = t("center.coinRainDescMax", { count: displayMaxCoin });
    if (this.elements.coinRainProgress) this.elements.coinRainProgress.textContent = `${earnedCoin} / ${displayMaxCoin}`;
    const completed = status.state === "completed" || status.state === "playing";
    entry.classList.toggle("is-completed", completed);
    if (status.state === "boost_available") action.textContent = t("center.coinRainBoost");
    else action.textContent = completed ? t("center.coinRainCompleted") : t("center.coinRainPlay");
  },

  clearCoinRainLocalTimers() {
    clearTimer(this._coinRainCountdownTimer);
    clearTimer(this._coinRainSpawnTimer);
    clearTimer(this._coinRainGameTimer);
    this._coinRainCountdownTimer = this._coinRainSpawnTimer = this._coinRainGameTimer = 0;
  },

  startCoinRainSession(result) {
    if (!result?.session_id || !this.elements.coinRainOverlay) return;
    // Guard against double-start stacking timers/overlays.
    if (this._coinRainSession) {
      this.clearCoinRainLocalTimers();
      this.elements.coinRainStage?.replaceChildren();
    }
    this._coinRainSession = {
      sessionId: String(result.session_id),
      rewardCap: Math.max(1, Number(result.reward_cap ?? 1) || 1),
      duration: Math.max(10, Number(result.duration_seconds ?? 30) || 30),
      clicked: 0,
      running: false,
      paused: false,
      pauseStartedAt: 0,
      endAt: 0,
    };
    this.elements.coinRainCollected.textContent = "0";
    this.elements.coinRainTime.textContent = `00:${String(this._coinRainSession.duration).padStart(2, "0")}`;
    if (this.elements.coinRainCountdownMax) {
      const displayMaxCoin = Number(result.display_max_coin ?? this._coinRainStatus?.display_max_coin ?? 400) || 400;
      this.elements.coinRainCountdownMax.textContent = t("center.coinRainUpTo", { count: displayMaxCoin });
    }
    this.elements.coinRainStage.replaceChildren();
    this.elements.coinRainCountdown.style.display = "flex";
    this.elements.coinRainOverlay.classList.add("is-countdown");
    this.elements.coinRainOverlay.classList.remove("is-paused");
    this.hideCoinRainLeaveDialog(false);
    this.elements.coinRainOverlay.style.display = "block";
    if (typeof document !== "undefined" && document.body) document.body.style.overflow = "hidden";
    if (!this._coinRainVisibilityHandler) {
      this._coinRainVisibilityHandler = () => {
        // PRD: leaving/background during prep or play should confirm via Leave dialog.
        if (document.hidden && this._coinRainSession) this.leaveCoinRain();
      };
      document.addEventListener("visibilitychange", this._coinRainVisibilityHandler);
    }
    let count = 3;
    this.elements.coinRainCountdownValue.textContent = String(count);
    this.clearCoinRainLocalTimers();
    this._coinRainCountdownTimer = window.setInterval(() => {
      if (this._coinRainSession?.paused) return;
      count -= 1;
      if (count > 0) {
        this.elements.coinRainCountdownValue.textContent = String(count);
        return;
      }
      clearTimer(this._coinRainCountdownTimer);
      this._coinRainCountdownTimer = 0;
      this.elements.coinRainCountdown.style.display = "none";
      this.runCoinRain();
    }, 1000);
  },

  runCoinRain() {
    const session = this._coinRainSession;
    if (!session || session.running) return;
    session.running = true;
    const durationMs = session.duration * 1000;
    session.endAt = Date.now() + durationMs;
    this.elements.coinRainOverlay.classList.remove("is-countdown");
    const spawnEvery = Math.max(110, Math.floor(durationMs / 200));
    const spawnCoin = () => {
      if (!session.running || session.paused) return;
      const coin = document.createElement("button");
      coin.type = "button";
      coin.className = "tc-coin-rain-coin";
      coin.innerHTML = `<img src="${assetUrl("icons/coin-rain-gold-coin.svg")}" alt="">`;
      coin.style.left = `${4 + Math.random() * 84}%`;
      coin.style.setProperty("--coin-size", `${38 + Math.floor(Math.random() * 25)}px`);
      coin.style.setProperty("--fall-duration", `${3.2 + Math.random() * 1.8}s`);
      coin.addEventListener("click", () => {
        if (!session.running || coin.dataset.claimed === "1" || session.clicked >= session.rewardCap) return;
        coin.dataset.claimed = "1";
        session.clicked += 1;
        this.elements.coinRainCollected.textContent = String(session.clicked);
        coin.remove();
      });
      coin.addEventListener("animationend", () => coin.remove());
      this.elements.coinRainStage.appendChild(coin);
    };
    this._coinRainSpawnTimer = window.setInterval(spawnCoin, spawnEvery);
    this._coinRainGameTimer = window.setInterval(() => {
      if (session.paused) return;
      const remaining = Math.max(0, session.endAt - Date.now());
      this.elements.coinRainTime.textContent = `00:${String(Math.ceil(remaining / 1000)).padStart(2, "0")}`;
      if (remaining <= 0) this.finishCoinRain();
    }, 200);
  },

  async finishCoinRain() {
    const session = this._coinRainSession;
    if (!session?.running) return;
    session.running = false;
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
      // Unstick the day: abandon leftover started session after settle failure.
      this.abandonCoinRainImmediately();
      return;
    }
    this._coinRainSession = null;
    this.showCoinRainResult(result);
  },

  leaveCoinRain() {
    const session = this._coinRainSession;
    if (!session) return;
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
    if (session.running && session.endAt > 0) session.endAt += Math.max(0, Date.now() - session.pauseStartedAt);
    session.paused = false;
    session.pauseStartedAt = 0;
  },

  abandonCoinRainImmediately() {
    const session = this._coinRainSession;
    if (!session) return;
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
    this.config.onCoinRainAbandon({ sessionId: session.sessionId });
    this._coinRainSession = null;
  },

  setCoinRainResultHero(kind = "reward") {
    const img = this.elements.coinRainResultHeroImg;
    if (!img) return;
    const file = kind === "boost-prompt" ? "images/coin-rain-boost-prompt-art.png" : "images/coin-rain-reward-art.png";
    img.src = assetUrl(file);
    img.width = kind === "boost-prompt" ? 240 : 188;
    img.height = kind === "boost-prompt" ? 120 : 118;
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
    this.elements.coinRainResult.classList.remove("is-boost-prompt");
    this.elements.coinRainResult.classList.add("is-boost-success");
    this.setCoinRainResultHero("reward");
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
      this.abandonCoinRainImmediately();
    }
    this.clearCoinRainLocalTimers();
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
