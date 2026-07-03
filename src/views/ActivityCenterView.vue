<script setup>
import "../assets/activity-center.css";
import { assetUrl } from "../lib/asset-url.js";
import { ROUTE_NAMES } from "../lib/activity-pages.js";
import { useLazyActivityPage } from "../composables/useLazyActivityPage.js";
import { useI18n } from "../composables/useI18n.js";

const { t } = useI18n();

useLazyActivityPage(ROUTE_NAMES.ACTIVITY_CENTER, {
  logTag: "ActivityCenter",
  loadModule: () => import("../boot/initActivityCenter.js"),
  bootstrap: (module, ctx) => module.initActivityCenter(ctx),
});
</script>

<template>
  <div class="task-center-root">
    <main class="tc-main">
      <section id="tc-checkin-section" class="tc-section">
        <div class="tc-card tc-balance-card">
          <div class="tc-balance-main">
            <div class="tc-balance-icon">
              <div class="tc-balance-icon-inner">
                <img :src="assetUrl('icons/gold_coin.svg')" alt="coins" class="icon-img" width="24" height="24" fetchpriority="high">
              </div>
            </div>
            <div class="tc-balance-left">
              <div class="tc-balance-label">{{ t('center.myBalance') }}</div>
              <div class="tc-balance-value">
                <span id="goldCoins">0</span>
                <span class="tc-balance-unit">{{ t('common.goldCoins') }}</span>
              </div>
            </div>
          </div>
          <button class="tc-primary-btn" id="exchangeBtn" type="button">{{ t('center.redeem') }}</button>
        </div>
      </section>

      <section id="tc-video-task-section" class="tc-section">
        <div class="tc-card tc-flow-card">
          <h2 class="tc-flow-title">{{ t('center.flowTitle') }}</h2>
          <div class="tc-flow-steps">
            <div class="tc-flow-step">
              <div class="tc-flow-icon">
                <img :src="assetUrl('icons/task_alt.svg')" alt="tasks" class="icon-img" width="24" height="24" loading="lazy" decoding="async">
              </div>
              <p class="tc-flow-text tc-flow-text--multiline">{{ t('center.flowStepTasks') }}</p>
            </div>
            <div class="tc-flow-step">
              <div class="tc-flow-icon">
                <img :src="assetUrl('icons/gold_coin.svg')" alt="coins" class="icon-img" width="24" height="24" loading="lazy" decoding="async">
              </div>
              <p class="tc-flow-text tc-flow-text--multiline">{{ t('center.flowStepCoins') }}</p>
            </div>
            <div class="tc-flow-step">
              <div class="tc-flow-icon">
                <img :src="assetUrl('icons/phone_iphone.svg')" alt="credit" class="icon-img" width="24" height="24" loading="lazy" decoding="async">
              </div>
              <p class="tc-flow-text tc-flow-text--multiline">{{ t('center.flowStepCredit') }}</p>
            </div>
          </div>
          <div class="tc-flow-footer">
            <span class="tc-flow-badge">{{ t('center.flowTipBadge') }}</span>
            <span class="tc-flow-desc">{{ t('center.flowTipDesc') }}</span>
          </div>
        </div>
      </section>

      <section id="tc-daily-checkin-section" class="tc-section">
        <div class="tc-card tc-checkin-card">
          <div class="tc-card-header">
            <h2 class="tc-card-title">{{ t('center.dailyCheckin') }}</h2>
            <span class="tc-pill" id="tc-checkin-pill">0/7 Days</span>
          </div>
          <div id="tc-checkin-days-container" class="tc-checkin-days" />
          <button id="signin-timer-btn" type="button" class="tc-primary-btn tc-primary-btn--full">
            <img :src="assetUrl('icons/calendar_today.svg')" class="tc-icon-calendar" alt="" width="20" height="20" loading="lazy" decoding="async">
            <span>{{ t('center.checkinNow') }}</span>
          </button>
          <p class="tc-checkin-tip">{{ t('center.superPrizeDay') }}</p>
        </div>
      </section>

      <section id="tc-lucky-spin-section" class="tc-section">
        <h2 class="tc-section-title">{{ t('center.tasksForYou') }}</h2>
        <div class="tc-card tc-video-card">
          <div class="tc-video-head">
            <div id="btn-spin-entry" class="tc-video-icon">
              <img :src="assetUrl('icons/spin_s_80.svg')" class="tc-icon--large" alt="" width="80" height="80" loading="lazy" decoding="async">
              <span class="tc-video-badge">{{ t('center.luckyBadge') }}</span>
              <span class="tc-video-play-chip">{{ t('center.playBadge') }}</span>
            </div>
            <div class="tc-video-text">
              <h3 class="tc-card-title">{{ t('center.luckySpinTitle') }}</h3>
              <p id="ad-task-desc" class="tc-card-subtitle">
                Each video unlocks 1 lucky spin. Win up to 200 coins per spin!
              </p>
            </div>
          </div>
          <div class="tc-video-progress tc-video-stats">
            <div class="tc-video-progress-header">
              <span class="tc-video-progress-item">
                <span class="tc-video-progress-label">{{ t('center.earnedToday') }}</span>
                <span id="ad-earned-text">0 Coins</span>
              </span>
              <span class="tc-video-progress-item tc-video-progress-item-right">
                <span class="tc-video-progress-label">{{ t('center.progress') }}</span>
                <span id="ad-progress-videos" class="tc-video-progress-value">0 / 5 Spins</span>
              </span>
            </div>
            <div class="tc-video-progress-bar">
              <div id="ad-progress-bar-fill" class="tc-video-progress-fill" />
            </div>
          </div>
          <div class="tc-video-actions tc-video-actions--single">
            <button id="btn-watch-ad" type="button" class="tc-secondary-btn tc-watch-spin-btn">
              <img :src="assetUrl('icons/play_arrow.svg')" class="tc-icon-play" alt="" width="20" height="20" loading="lazy" decoding="async">
              <span>{{ t('center.watchAndSpin') }}</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  </div>

  <div id="spinWheelModal" class="tc-spin-modal-overlay" style="display:none;">
    <div class="tc-spin-modal">
      <button id="spinWheelClose" type="button" class="tc-spin-close" :aria-label="t('common.close')">✕</button>
      <div class="tc-spin-badge">★</div>
      <h2 class="tc-spin-title">{{ t('center.spinForReward') }}</h2>
      <p id="spinWheelSubtitle" class="tc-spin-subtitle">{{ t('center.spinSubtitleWatch') }}</p>
      <div class="tc-spin-wheel-wrap">
        <div class="tc-spin-pointer" />
        <div id="spinWheelDisk" class="tc-spin-wheel">
          <span class="tc-spin-label tc-spin-label-1">10</span>
          <span class="tc-spin-label tc-spin-label-2">20</span>
          <span class="tc-spin-label tc-spin-label-3">30</span>
          <span class="tc-spin-label tc-spin-label-4">50</span>
          <span class="tc-spin-label tc-spin-label-5">100</span>
          <span class="tc-spin-label tc-spin-label-6">150</span>
          <span class="tc-spin-label tc-spin-label-7">200</span>
          <span class="tc-spin-label tc-spin-label-8">10</span>
          <div class="tc-spin-wheel-center" />
        </div>
      </div>
      <button id="spinWheelSpinBtn" type="button" class="tc-spin-now-btn">{{ t('center.watchToSpin') }}</button>
    </div>
  </div>

  <div id="spinRewardModal" class="tc-spin-reward-overlay" style="display:none;">
    <div class="tc-spin-reward-modal">
      <button id="spinRewardClose" type="button" class="tc-spin-reward-close" :aria-label="t('common.close')">✕</button>
      <div class="tc-spin-reward-celebration">
        <div class="tc-spin-reward-celebration-ring" />
        <div class="tc-spin-reward-icon">🎉</div>
      </div>
      <h3 class="tc-spin-reward-title">{{ t('center.amazing') }}</h3>
      <p class="tc-spin-reward-subtitle">{{ t('center.spinRewardSubtitle') }}</p>
      <div class="tc-spin-reward-coin-line">
        <span id="spinRewardCoins">+0</span>
        <span>{{ t('common.coins').toUpperCase() }}</span>
      </div>
      <p class="tc-spin-reward-foot">{{ t('center.spinRewardFoot') }}</p>
    </div>
  </div>

  <div id="signinDialog" class="signin-dialog-overlay" style="display: none;">
    <div class="signin-dialog-sheet">
      <div class="signin-dialog-handle" aria-hidden="true" />
      <div class="signin-dialog-body">
        <div id="signinDialogCelebration" class="signin-dialog-celebration">
          <div class="signin-dialog-celebration-ring" />
          <div class="signin-dialog-celebration-icon">🎉</div>
        </div>
        <h2 id="signinDialogTitle" class="signin-dialog-title">{{ t('center.checkinSuccess') }}</h2>
        <div id="signinDialogBaseCoinsWrap" class="signin-dialog-base-coins-wrap">
          <span id="signinDialogBaseCoins" class="signin-dialog-base-coins">+0 Coins</span>
        </div>
        <div class="signin-dialog-boost-card">
          <p class="signin-dialog-boost-title">{{ t('center.doubleReward') }}</p>
          <p id="signinDialogBoostDesc" class="signin-dialog-boost-desc">
            Watch a short video to turn <strong>5</strong> coins into <strong>10</strong> coins
          </p>
          <button id="signinDialogWatchBtn" type="button" class="signin-dialog-watch-btn">
            <img :src="assetUrl('icons/play_circle.svg')" alt="" class="signin-dialog-watch-icon" width="24" height="24">
            <span id="signinDialogWatchBtnLabel">{{ t('center.doubleWatchLabel', { totalCoin: 10 }) }}</span>
          </button>
          <button id="signinDialogClaimBaseOnly" type="button" class="signin-dialog-claim-base">{{ t('center.claimBaseOnly', { baseCoin: 5 }) }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
