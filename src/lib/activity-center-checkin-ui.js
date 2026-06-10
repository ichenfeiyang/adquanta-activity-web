import { assetUrl } from "./asset-url.js";
import { resolveSigninRewardCoins } from "./activity-center-ui-helpers.js";

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

function paintCheckinDayNode(node, { day, coin, isDone, isDay7, superReward }) {
  const { dayEl, dotEl, labelEl } = node;
  dayEl.dataset.day = String(day);

  let dayClass = "tc-checkin-day";
  let labelClass = "tc-checkin-label";
  if (isDay7) {
    dayClass += " tc-checkin-day--super";
    labelClass += " tc-checkin-label--super";
  } else if (isDone) {
    dayClass += " tc-checkin-day--done";
  }
  dayEl.className = dayClass;
  labelEl.className = labelClass;
  labelEl.textContent = `Day ${day}`;

  dotEl.replaceChildren();
  if (isDay7) {
    dotEl.className = "tc-checkin-dot tc-checkin-dot--super";
    const amount = isDone ? coin : superReward;
    const img = document.createElement("img");
    img.src = assetUrl("icons/card_giftcard.svg");
    img.alt = "gift";
    img.className = "tc-checkin-super-icon-img";
    const reward = document.createElement("span");
    reward.className = "tc-checkin-super-reward";
    reward.textContent = `+${amount}`;
    dotEl.appendChild(img);
    dotEl.appendChild(reward);
    return;
  }

  if (isDone) {
    dotEl.className = "tc-checkin-dot";
    const mark = document.createElement("span");
    mark.textContent = "✓";
    const amount = document.createElement("span");
    amount.textContent = `+${coin}`;
    dotEl.appendChild(mark);
    dotEl.appendChild(amount);
    return;
  }

  dotEl.className = "tc-checkin-dot tc-checkin-dot--reward";
  dotEl.textContent = `+${coin}`;
}

export const checkinUiMixin = {
  showSigninDialog(reward) {
    const alreadyChecked = !!reward?.alreadyChecked;
    const { baseCoin, totalCoin } = resolveSigninRewardCoins(reward);

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
        ? `You have earned ${baseCoin} Coins`
        : `+${baseCoin} Coins`;
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
        })
      : "empty";
    if (fingerprint === this._lastCheckinFingerprint) return;
    this._lastCheckinFingerprint = fingerprint;

    const continuousDays = (detail && typeof detail.continuous_days === "number") ? detail.continuous_days : 0;
    const pill = this.elements.checkinPill;
    if (pill) {
      pill.textContent = `${continuousDays}/7 Days`;
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
          isDay7: day === 7,
          superReward: 0,
        });
      }
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
    const nodes = ensureCheckinDayGrid(container, this._checkinGridCache);

    daysList.forEach((dayInfo, idx) => {
      const isDay7 = dayInfo.day === 7 || idx === 6;
      const isDone = dayInfo.day <= continuousDays;
      paintCheckinDayNode(nodes[idx], {
        day: dayInfo.day,
        coin: dayInfo.coin,
        isDone,
        isDay7,
        superReward,
      });
    });

    for (let idx = daysList.length; idx < 7; idx += 1) {
      paintCheckinDayNode(nodes[idx], {
        day: idx + 1,
        coin: 0,
        isDone: false,
        isDay7: idx === 6,
        superReward,
      });
    }

    const signinBtn = this.elements.signinTimerBtn;
    if (signinBtn) {
      const today = daysList.find((d) => d.current === true);
      const received = !!today?.received;
      const videoReceived = !!today?.video_received;
      this._signinVideoCompleted = videoReceived;
      const allCompleted = received && videoReceived;
      const canCheckin = !allCompleted;
      signinBtn.disabled = false;
      signinBtn.removeAttribute("aria-disabled");
      if (allCompleted) {
        signinBtn.setAttribute("aria-disabled", "true");
        signinBtn.classList.add("tc-secondary-btn", "is-completed");
      } else {
        signinBtn.classList.remove("tc-secondary-btn", "is-completed");
      }
      const span = signinBtn.querySelector("span");
      if (span) span.textContent = canCheckin ? "Check-in Now" : "Completed";
    }
    this.updateSigninDialogVideoButtonState();
  },

  updateSigninDialogBoostCopy({ baseCoin, totalCoin }) {
    this._signinTotalCoin = totalCoin;
    if (this.elements.signinDialogBoostDesc) {
      this.elements.signinDialogBoostDesc.innerHTML =
        `Watch a short video to turn <strong>${baseCoin}</strong> coins into <strong>${totalCoin}</strong> coins`;
    }
    if (this.elements.signinDialogWatchBtnLabel) {
      this.elements.signinDialogWatchBtnLabel.textContent = `Double to ${totalCoin} Coins · Watch Video`;
    }
    if (this.elements.signinDialogClaimBaseOnly) {
      this.elements.signinDialogClaimBaseOnly.textContent = `No thanks, claim ${baseCoin} coins`;
    }
  },

  updateSigninDialogVideoButtonState() {
    const watchBtn = this.elements.signinDialogWatchBtn;
    if (!watchBtn) return;
    watchBtn.disabled = this._signinVideoCompleted;
    watchBtn.classList.toggle("is-completed", this._signinVideoCompleted);
    if (this._signinVideoCompleted) {
      watchBtn.textContent = "Completed";
      return;
    }
    if (!watchBtn.querySelector(".signin-dialog-watch-icon")) {
      watchBtn.innerHTML = `
        <img src="${assetUrl("icons/play_circle.svg")}" alt="" class="signin-dialog-watch-icon" width="24" height="24">
        <span id="signinDialogWatchBtnLabel">Double to ${this._signinTotalCoin || 0} Coins · Watch Video</span>
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
