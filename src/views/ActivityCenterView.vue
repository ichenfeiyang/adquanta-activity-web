<script setup>
import "../assets/activity-center.css";
import { assetUrl } from "../lib/asset-url.js";
import { ROUTE_NAMES } from "../lib/activity-pages.js";
import { useLazyActivityPage } from "../composables/useLazyActivityPage.js";
import { useI18n } from "../composables/useI18n.js";
import ActivityLanguageSwitcher from "../components/ActivityLanguageSwitcher.vue";

const { t } = useI18n();

useLazyActivityPage(ROUTE_NAMES.ACTIVITY_CENTER, {
  logTag: "ActivityCenter",
  loadModule: () => import("../boot/initActivityCenter.js"),
  bootstrap: (module, ctx) => module.initActivityCenter(ctx),
});
</script>

<template>
  <div class="task-center-root">
    <header class="tc-page-header">
      <h1 class="tc-page-title">{{ t('center.rewardsTitle') }}</h1>
      <ActivityLanguageSwitcher />
    </header>
    <main class="tc-main">
      <section id="tc-checkin-section" class="tc-section">
        <div class="tc-card tc-balance-card">
          <div class="tc-balance-top">
            <div class="tc-balance-main">
              <div class="tc-balance-icon" aria-hidden="true">
                <img :src="assetUrl('icons/gold_coin.svg')" alt="" class="tc-balance-icon-img" width="44" height="44" fetchpriority="high">
              </div>
              <div class="tc-balance-left">
                <div class="tc-balance-label">{{ t('center.myBalance') }}</div>
                <div class="tc-balance-value">
                  <span id="goldCoins">0</span>
                  <span class="tc-balance-unit">{{ t('common.coins') }}</span>
                </div>
              </div>
            </div>
            <button class="tc-primary-btn tc-balance-redeem-btn" id="exchangeBtn" type="button">{{ t('center.redeem') }}</button>
          </div>
          <div id="redeemGapPanel" class="tc-redeem-gap-panel" style="display:none;">
            <div class="tc-redeem-progress-track" aria-hidden="true">
              <div id="redeemGapProgress" class="tc-redeem-progress-fill" style="width:0%;"></div>
            </div>
            <div id="redeemGapHint" class="tc-redeem-gap-hint"></div>
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
            <img :src="assetUrl('icons/gold-coin-white.svg')" class="tc-icon-calendar" alt="" width="20" height="20" loading="lazy" decoding="async">
            <span>{{ t('center.checkinNow') }}</span>
          </button>
        </div>
      </section>

      <section id="tc-lucky-spin-section" class="tc-section">
        <div class="tc-card tc-video-card">
          <div class="tc-video-head">
            <div id="btn-spin-entry" class="tc-video-icon">
              <div class="tc-spin-card-wheel" aria-hidden="true">
                <span class="tc-spin-card-label tc-spin-card-label-1">10</span>
                <span class="tc-spin-card-label tc-spin-card-label-2">20</span>
                <span class="tc-spin-card-label tc-spin-card-label-3">30</span>
                <span class="tc-spin-card-label tc-spin-card-label-4">50</span>
                <span class="tc-spin-card-label tc-spin-card-label-5">100</span>
                <span class="tc-spin-card-label tc-spin-card-label-6">150</span>
                <span class="tc-spin-card-label tc-spin-card-label-7">200</span>
                <span class="tc-spin-card-label tc-spin-card-label-8">10</span>
                <div class="tc-spin-card-wheel-center">
                  <img :src="assetUrl('icons/gold_coin.svg')" alt="" width="32" height="32" loading="lazy" decoding="async">
                </div>
              </div>
            </div>
            <div class="tc-video-text">
              <div class="tc-video-title-row">
                <h3 class="tc-card-title">{{ t('center.luckySpinTitle') }}</h3>
                <span class="tc-video-badge">{{ t('center.luckyBadge') }}</span>
              </div>
              <p id="ad-task-desc" class="tc-card-subtitle">
                <span>{{ t('center.luckySpinDescLine1') }}</span>
                <span>{{ t('center.luckySpinDescLine2') }} <strong id="ad-max-coin" class="tc-spin-max-coin">200 Coins!</strong></span>
              </p>
              <div class="tc-video-progress tc-video-stats">
                <span class="tc-video-progress-item">
                  <span class="tc-video-stat-icon tc-video-stat-icon--spin">+</span>
                  <span class="tc-video-stat-copy">
                    <span id="ad-progress-videos" class="tc-video-progress-value">0 / 5</span>
                    <span class="tc-video-progress-label">{{ t('center.spinsLeftToday') }}</span>
                  </span>
                </span>
                <span class="tc-video-stat-divider" aria-hidden="true" />
                <span class="tc-video-progress-item tc-video-progress-item-right">
                  <img :src="assetUrl('icons/gold_coin.svg')" alt="" class="tc-video-stat-coin" width="20" height="20" loading="lazy" decoding="async">
                  <span class="tc-video-stat-copy">
                    <span id="ad-earned-text" class="tc-video-progress-value">0 / 0</span>
                    <span class="tc-video-progress-label">{{ t('center.dailyCoinLimit') }}</span>
                  </span>
                </span>
              </div>
            </div>
            <div class="tc-video-actions tc-video-actions--single">
              <button id="btn-watch-ad" type="button" class="tc-secondary-btn tc-watch-spin-btn">
                <span>{{ t('center.watchVideoToSpinLine1') }}</span>
                <span>{{ t('center.watchVideoToSpinLine2') }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="tc-redeem-rewards-section" class="tc-section" style="display:none;">
        <div class="tc-card tc-redeem-rewards-card">
          <h2 class="tc-redeem-rewards-title">{{ t('center.redeemRewardsTitle') }}</h2>
          <p class="tc-redeem-rewards-subtitle">{{ t('center.redeemRewardsSubtitle') }}</p>
          <div id="tc-redeem-rewards-list" class="tc-redeem-rewards-list" />
        </div>
      </section>

      <section id="tc-video-task-section" class="tc-section">
        <div class="tc-card tc-flow-card">
          <h2 class="tc-flow-title">{{ t('center.flowHowTitle') }}</h2>
          <div class="tc-flow-steps">
            <div class="tc-flow-step">
              <div class="tc-flow-icon">
                <img :src="assetUrl('icons/gold_coin.svg')" alt="" class="icon-img" width="44" height="44" loading="lazy" decoding="async">
              </div>
              <div class="tc-flow-copy">
                <div class="tc-flow-heading">
                  <span class="tc-flow-index">1</span>
                  <span>{{ t('center.flowStepEarnTitle') }}</span>
                </div>
                <p class="tc-flow-desc">{{ t('center.flowStepEarnDesc') }}</p>
              </div>
            </div>
            <div class="tc-flow-arrow" aria-hidden="true">›</div>
            <div class="tc-flow-step">
              <div class="tc-flow-icon tc-flow-icon--threshold">
                <span class="tc-flow-progress-icon">
                  <span class="tc-flow-progress-fill"></span>
                </span>
              </div>
              <div class="tc-flow-copy">
                <div class="tc-flow-heading">
                  <span class="tc-flow-index">2</span>
                  <span>{{ t('center.flowStepThresholdTitle') }}</span>
                </div>
                <p class="tc-flow-desc">{{ t('center.flowStepThresholdDesc') }}</p>
              </div>
            </div>
            <div class="tc-flow-arrow" aria-hidden="true">›</div>
            <div class="tc-flow-step">
              <div class="tc-flow-icon">
                <img :src="assetUrl('icons/card_giftcard.svg')" alt="" class="icon-img" width="44" height="44" loading="lazy" decoding="async">
              </div>
              <div class="tc-flow-copy">
                <div class="tc-flow-heading">
                  <span class="tc-flow-index">3</span>
                  <span>{{ t('center.flowStepRedeemTitle') }}</span>
                </div>
                <p class="tc-flow-desc">{{ t('center.flowStepRedeemDesc') }}</p>
              </div>
            </div>
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

  <div id="newUserBonusModal" class="new-user-bonus-overlay" style="display:none;">
    <div class="new-user-bonus-card">
      <div class="new-user-bonus-badge" id="newUserBonusTitle">{{ t('center.newUserBonusTitle') }}</div>
      <div class="new-user-bonus-art" aria-hidden="true">
        <img
          :src="assetUrl('images/new-user-bonus-hero.png')"
          alt=""
          class="new-user-bonus-hero"
          width="650"
          height="379"
        >
        <span id="newUserBonusAmount" class="new-user-bonus-amount">50</span>
      </div>
      <h2 id="newUserBonusHeadline" class="new-user-bonus-headline">
        You got <strong id="newUserBonusHeadlineCoin">50</strong> Coins!
      </h2>
      <p id="newUserBonusDesc" class="new-user-bonus-desc">
        Watch a short video to double your reward to <strong id="newUserBonusVideoCoin">100</strong> coins.
      </p>
      <p id="newUserBonusFoot" class="new-user-bonus-foot">{{ t('center.newUserBonusFoot') }}</p>
      <button id="newUserBonusDoubleBtn" type="button" class="new-user-bonus-primary">
        <img :src="assetUrl('icons/video_outline.svg')" alt="" class="new-user-bonus-btn-icon" width="28" height="28">
        <span id="newUserBonusDoubleBtnLabel">{{ t('center.newUserBonusDouble') }}</span>
      </button>
      <button id="newUserBonusMaybeLater" type="button" class="new-user-bonus-secondary">
        {{ t('center.newUserBonusMaybeLater') }}
      </button>
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
