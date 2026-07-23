import { assetUrl } from "./asset-url.js";
import { normalizeCheckinChestEligibleDays } from "./checkin-chest.js";
import { resolveSigninRewardCoins } from "./activity-center-ui-helpers.js";
import { t } from "./i18n/activity-locale.js";

function ensureCheckinDayGrid(container, cache) {
  if (cache.nodes?.length === 7 && cache.container === container) {
    return cache.nodes;
  }

  container.replaceChildren();
  const nodes = [];
  for (let day = 1; day <= 7; day += 1) {
    const dayEl = document.createElement("div");
    dayEl.dataset.day = String(day);
    const dotEl = document.createElement("div");
    const labelEl = document.createElement("span");
    dayEl.appendChild(dotEl);
    dayEl.appendChild(labelEl);
    container.appendChild(dayEl);
    nodes.push({ dayEl, dotEl, labelEl });
  }

  cache.container = container;
  cache.nodes = nodes;
  return nodes;
}

function paintCheckinDayNode(node, { day, coin, isDone, isCurrent, isChestDay, hasPendingChest }) {
  const { dayEl, dotEl, labelEl } = node;
  dayEl.dataset.day = String(day);

  let dayClass = "tc-checkin-day";
  let labelClass = "tc-checkin-label";
  // Pending = already dropped (deeper style). Eligible-only = future preview (lighter).
  const showChestMarker = hasPendingChest || (!isDone && isChestDay);
  if (hasPendingChest) {
    dayClass += " tc-checkin-day--chest tc-checkin-day--pending-chest";
    labelClass += " tc-checkin-label--chest tc-checkin-label--pending-chest";
  } else if (isDone) {
    dayClass += " tc-checkin-day--done";
  } else if (isChestDay) {
    dayClass += " tc-checkin-day--chest tc-checkin-day--eligible-chest";
    labelClass += " tc-checkin-label--chest";
  }
  if (isCurrent && !isDone && !showChestMarker) {
    dayClass += " tc-checkin-day--current";
    labelClass += " tc-checkin-label--current";
  }
  dayEl.className = dayClass;
  labelEl.className = labelClass;
  labelEl.textContent = t("common.day", { day });

  dotEl.replaceChildren();
  if (hasPendingChest) {
    dotEl.className = "tc-checkin-dot tc-checkin-dot--chest tc-checkin-dot--pending-chest";
    const img = document.createElement("img");
    img.src = assetUrl("icons/card_giftcard.svg");
    img.alt = "";
    img.className = "tc-checkin-chest-icon-img";
    dotEl.appendChild(img);
    return;
  }

  if (!isDone && isChestDay) {
    dotEl.className = "tc-checkin-dot tc-checkin-dot--chest tc-checkin-dot--eligible-chest";
    const img = document.createElement("img");
    img.src = assetUrl("icons/card_giftcard.svg");
    img.alt = "";
    img.className = "tc-checkin-chest-icon-img";
    dotEl.appendChild(img);
    return;
  }

  if (isDone) {
    dotEl.className = "tc-checkin-dot";
    const mark = document.createElement("span");
    mark.textContent = "✓";
    dotEl.appendChild(mark);
    return;
  }

  dotEl.className = "tc-checkin-dot tc-checkin-dot--reward";
  dotEl.textContent = `+${coin}`;
}

export const checkinUiMixin = {
  showCheckinPrompt(detail, prompt) {
    if (!detail || !Array.isArray(detail.days) || !this.elements.checkinPromptModal) return;
    const days = detail.days.slice(0, 7);
    const current = days.find((day) => day.current === true) || days.find((day) => day.received !== true) || days[0];
    const coin = Number(current?.coin || 0);
    this._checkinPrompt = { detail, prompt };

    if (this.elements.checkinPromptTitle) {
      const title = t("center.checkinPromptTitle", { coin });
      const coinText = String(coin);
      const coinOffset = title.indexOf(coinText);
      if (coinOffset < 0) {
        this.elements.checkinPromptTitle.textContent = title;
      } else {
        const highlightedCoin = document.createElement("span");
        highlightedCoin.className = "checkin-prompt-title-coin";
        highlightedCoin.textContent = coinText;
        this.elements.checkinPromptTitle.replaceChildren(
          title.slice(0, coinOffset),
          highlightedCoin,
          title.slice(coinOffset + coinText.length),
        );
      }
    }
    const daysContainer = this.elements.checkinPromptDays;
    if (daysContainer) {
      daysContainer.replaceChildren();
      const chestDays = new Set(normalizeCheckinChestEligibleDays(detail.chest_eligible_days));
      const formattedChestDays = [...chestDays]
        .sort((left, right) => left - right)
        .map((day) => t("common.day", { day }))
        .join(", ");
      if (this.elements.checkinPromptChestTip && this.elements.checkinPromptChestTipText) {
        const hasChestDays = formattedChestDays.length > 0;
        this.elements.checkinPromptChestTip.style.display = hasChestDays ? "flex" : "none";
        if (!hasChestDays) {
          this.elements.checkinPromptChestTipText.replaceChildren();
        } else {
          const template = t("center.checkinPromptChestTip", { days: "{days}" });
          const [prefix = "", suffix = ""] = template.split("{days}");
          const highlightedDays = document.createElement("span");
          highlightedDays.className = "checkin-prompt-chest-tip-days";
          highlightedDays.textContent = formattedChestDays;
          // Keep configured chest days on their own line in the compact dialog.
          this.elements.checkinPromptChestTipText.replaceChildren(prefix, document.createElement("br"), highlightedDays, suffix);
        }
      }
      const pendingChestDays = new Set(
        (Array.isArray(detail.chests) ? detail.chests : [])
          .filter((chest) => chest?.status === "pending")
          .map((chest) => Number(chest.continuous_day)),
      );
      days.forEach((day) => {
        const item = document.createElement("div");
        const isCurrent = day.day === current?.day;
        const hasChest = !day.received && (chestDays.has(Number(day.day)) || pendingChestDays.has(Number(day.day)));
        item.className = `checkin-prompt-day${day.received ? " is-done" : ""}${isCurrent ? " is-current" : ""}${hasChest ? " is-chest" : ""}`;
        const label = document.createElement("span");
        label.className = "checkin-prompt-day-label";
        label.textContent = t("common.day", { day: day.day });
        const reward = document.createElement("strong");
        reward.className = "checkin-prompt-day-reward";
        reward.textContent = day.received ? "✓" : `+${Number(day.coin || 0)}`;
        const unit = document.createElement("span");
        unit.className = "checkin-prompt-day-unit";
        unit.textContent = t("common.coins");
        item.append(label);
        if (hasChest) {
          const chestIcon = document.createElement("img");
          chestIcon.src = assetUrl("images/checkin-prompt-lucky-chest.png");
          chestIcon.alt = "";
          chestIcon.className = "checkin-prompt-chest-icon";
          item.appendChild(chestIcon);
        }
        item.appendChild(reward);
        // Always render this slot so completed days keep the same reward layout
        // as pending days. Its content is visually hidden for completed days.
        item.appendChild(unit);
        daysContainer.appendChild(item);
      });
    }
    this.elements.checkinPromptModal.style.display = "flex";
  },

  hideCheckinPrompt() {
    if (this.elements.checkinPromptModal) {
      this.elements.checkinPromptModal.style.display = "none";
    }
  },

  updateCheckinVideoTip(totalCoin = 20) {
    if (this.elements.checkinVideoTip) {
      this.elements.checkinVideoTip.textContent = t("center.checkinVideoTip", { totalCoin });
    }
  },

  showSigninDialog(reward) {
    const alreadyChecked = !!reward?.alreadyChecked;
    const { baseCoin, totalCoin } = resolveSigninRewardCoins(reward);

    if (this.elements.signinDialogCelebration) {
      this.elements.signinDialogCelebration.style.display = "";
    }
    if (this.elements.signinDialogTitle) {
      this.elements.signinDialogTitle.style.display = "";
      this.elements.signinDialogTitle.classList.toggle("signin-dialog-title--muted", alreadyChecked);
      this.elements.signinDialogTitle.textContent = alreadyChecked
        ? t("center.alreadyCheckedInTitle")
        : t("center.checkinSuccess");
    }
    if (this.elements.signinDialogBaseCoinsWrap) {
      this.elements.signinDialogBaseCoinsWrap.style.display = "";
    }

    if (this.elements.signinDialogBaseCoins) {
      this.elements.signinDialogBaseCoins.textContent = alreadyChecked
        ? t("center.alreadyEarnedCoins", { count: baseCoin })
        : t("center.earnedCoinsAmount", { count: baseCoin });
      this.elements.signinDialogBaseCoins.classList.toggle("signin-dialog-base-coins--muted", alreadyChecked);
    }
    this.updateSigninDialogBoostCopy({ baseCoin, totalCoin });
    if (this.elements.signinDialog) {
      this.elements.signinDialog.style.display = "flex";
    }
    this.updateSigninDialogVideoButtonState();
  },

  hideSigninDialog() {
    if (this.elements.signinDialog) {
      this.elements.signinDialog.style.display = "none";
    }
  },

  updateCheckin(detail) {
    const fingerprint = detail
      ? JSON.stringify({
          continuous_days: detail.continuous_days,
          days: detail.days,
          chest_eligible_days: detail.chest_eligible_days,
          chests: detail.chests,
        })
      : "empty";
    if (fingerprint === this._lastCheckinFingerprint) return;
    this._lastCheckinFingerprint = fingerprint;

    const continuousDays = (detail && typeof detail.continuous_days === "number") ? detail.continuous_days : 0;
    const pill = this.elements.checkinPill;
    if (pill) {
      pill.textContent = t("common.daysProgress", { current: continuousDays });
    }

    const container = this.elements.checkinDaysContainer;
    if (!container) return;

    if (!this._checkinGridCache) {
      this._checkinGridCache = { container: null, nodes: [] };
    }

    if (!detail || !Array.isArray(detail.days) || detail.days.length === 0) {
      const nodes = ensureCheckinDayGrid(container, this._checkinGridCache);
      for (let day = 1; day <= 7; day += 1) {
        paintCheckinDayNode(nodes[day - 1], {
          day,
          coin: 0,
          isDone: false,
          isCurrent: false,
          isChestDay: false,
          hasPendingChest: false,
        });
      }
      if (this.elements.signinTimerBtn) {
        this.elements.signinTimerBtn.disabled = true;
        this.elements.signinTimerBtn.classList.remove("tc-secondary-btn", "is-completed");
        const span = this.elements.signinTimerBtn.querySelector("span");
        if (span) span.textContent = t("center.checkinNow");
      }
      this._signinVideoCompleted = false;
      this.updateCheckinVideoTip();
      return;
    }

    const eligibleChestDays = new Set(normalizeCheckinChestEligibleDays(detail.chest_eligible_days));
    const pendingChests = (Array.isArray(detail.chests) ? detail.chests : []).filter(
      (chest) => chest?.status === "pending",
    );
    const pendingChestByDay = new Map(
      pendingChests.map((chest) => [Number(chest.continuous_day), chest]),
    );
    const daysList = detail.days.slice(0, 7);
    const nodes = ensureCheckinDayGrid(container, this._checkinGridCache);

    daysList.forEach((dayInfo, idx) => {
      const dayNumber = Number(dayInfo.day);
      const pendingChest = pendingChestByDay.get(dayNumber) || null;
      const hasPendingChest = !!pendingChest;
      const isChestDay = eligibleChestDays.has(dayNumber) || hasPendingChest;
      const isDone = dayInfo.day <= continuousDays;
      paintCheckinDayNode(nodes[idx], {
        day: dayInfo.day,
        coin: dayInfo.coin,
        isDone,
        isCurrent: dayInfo.current === true,
        isChestDay,
        hasPendingChest,
      });
      const dayEl = nodes[idx]?.dayEl;
      if (dayEl) {
        if (hasPendingChest) {
          dayEl.setAttribute("role", "button");
          dayEl.tabIndex = 0;
          dayEl.onclick = () => this.config.onCheckinChestDayClick?.(pendingChest);
        } else {
          dayEl.removeAttribute("role");
          dayEl.removeAttribute("tabindex");
          dayEl.onclick = null;
        }
      }
    });

    for (let idx = daysList.length; idx < 7; idx += 1) {
      paintCheckinDayNode(nodes[idx], {
        day: idx + 1,
        coin: 0,
        isDone: false,
        isCurrent: false,
        isChestDay: false,
        hasPendingChest: false,
      });
      if (nodes[idx]?.dayEl) {
        nodes[idx].dayEl.removeAttribute("role");
        nodes[idx].dayEl.removeAttribute("tabindex");
        nodes[idx].dayEl.onclick = null;
      }
    }

    const signinBtn = this.elements.signinTimerBtn;
    const today = daysList.find((d) => d.current === true);
    const { totalCoin } = resolveSigninRewardCoins({
      coin: today?.coin,
      video_coin: today?.video_coin,
    });
    this.updateCheckinVideoTip(totalCoin || 20);
    if (signinBtn) {
      const received = !!today?.received;
      const videoReceived = !!today?.video_received;
      this._signinVideoCompleted = videoReceived;
      const hasPendingChest = pendingChestByDay.has(Number(today?.day));
      const checkinFlowDone = received && videoReceived;
      const allCompleted = checkinFlowDone && !hasPendingChest;
      signinBtn.disabled = false;
      signinBtn.removeAttribute("aria-disabled");
      if (allCompleted) {
        signinBtn.setAttribute("aria-disabled", "true");
        signinBtn.classList.add("tc-secondary-btn", "is-completed");
      } else {
        signinBtn.classList.remove("tc-secondary-btn", "is-completed");
      }
      const span = signinBtn.querySelector("span");
      if (span) {
        if (allCompleted) span.textContent = t("common.completed");
        else if (checkinFlowDone && hasPendingChest) span.textContent = t("center.checkinChestWatchVideo");
        else span.textContent = t("center.checkinNow");
      }
    }
    this.updateSigninDialogVideoButtonState();
  },

  updateSigninDialogBoostCopy({ baseCoin, totalCoin }) {
    this._signinTotalCoin = totalCoin;
    if (this.elements.signinDialogBoostDesc) {
      this.elements.signinDialogBoostDesc.innerHTML = t("center.boostDescHtml", { baseCoin, totalCoin });
    }
    if (this.elements.signinDialogWatchBtnLabel) {
      this.elements.signinDialogWatchBtnLabel.textContent = t("center.doubleWatchLabel", { totalCoin });
    }
    if (this.elements.signinDialogClaimBaseOnly) {
      this.elements.signinDialogClaimBaseOnly.textContent = t("center.claimBaseOnly", { baseCoin });
    }
  },

  updateSigninDialogVideoButtonState() {
    const watchBtn = this.elements.signinDialogWatchBtn;
    if (!watchBtn) return;
    watchBtn.disabled = this._signinVideoCompleted;
    watchBtn.classList.toggle("is-completed", this._signinVideoCompleted);
    if (this._signinVideoCompleted) {
      watchBtn.textContent = t("common.completed");
      return;
    }
    if (!watchBtn.querySelector(".signin-dialog-watch-icon")) {
      watchBtn.innerHTML = `
        <img src="${assetUrl("icons/play_circle.svg")}" alt="" class="signin-dialog-watch-icon" width="24" height="24">
        <span id="signinDialogWatchBtnLabel">${t("center.doubleWatchLabel", { totalCoin: this._signinTotalCoin || 0 })}</span>
      `;
      this.elements.signinDialogWatchBtnLabel = document.getElementById("signinDialogWatchBtnLabel");
    }
  },

  markSigninVideoCompleted() {
    this._signinVideoCompleted = true;
    this.setSigninWatchLoading(false);
    this.updateSigninDialogVideoButtonState();
  },

  isSigninVideoCompleted() {
    return this._signinVideoCompleted;
  },

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
  },

};
