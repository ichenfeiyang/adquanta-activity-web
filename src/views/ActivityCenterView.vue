<script setup>
import "../assets/activity-center.css";
import { assetUrl } from "../lib/asset-url.js";
import { ROUTE_NAMES } from "../lib/activity-pages.js";
import { useLazyActivityPage } from "../composables/useLazyActivityPage.js";
import { useI18n } from "../composables/useI18n.js";
import { useRoute, useRouter } from "vue-router";
import { goToFeedback } from "../lib/activity-navigation.js";
import { ACTIVITY_CENTER_PAGE_ID } from "../lib/activity-analytics.js";
import ActivityLanguageSwitcher from "../components/ActivityLanguageSwitcher.vue";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
function openFeedback() {
  window.ActivityBridgeHelper?.trackEvent?.("rewards_feedback_entry_click", {
    page_id: ACTIVITY_CENTER_PAGE_ID,
    element_id: "feedback_entry",
    element_name: "点击活动中心首页反馈按钮",
  });
  goToFeedback(router, String(route.query.activity_id || ""));
}

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
      <div class="tc-page-header-actions">
        <button type="button" class="tc-feedback-entry" @click="openFeedback">
          <span class="tc-feedback-entry-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M5.5 4.5h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7.2L7 20v-3.5H5.5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
              <circle cx="8" cy="10.5" r="1" fill="currentColor" />
              <circle cx="12" cy="10.5" r="1" fill="currentColor" />
              <circle cx="16" cy="10.5" r="1" fill="currentColor" />
            </svg>
          </span>
          <span>{{ t('pages.feedback') }}</span>
        </button>
        <ActivityLanguageSwitcher />
      </div>
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
                    <span id="ad-progress-videos" class="tc-video-progress-value">0 / 20</span>
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

      <section id="tc-coin-rain-section" class="tc-section" style="display:none;">
        <button id="tc-coin-rain-entry" type="button" class="tc-coin-rain-banner">
          <span class="tc-coin-rain-visual" aria-hidden="true">
            <img :src="assetUrl('images/coin-rain-card-art.png')" alt="" width="148" height="156" loading="lazy" decoding="async">
          </span>
          <span class="tc-coin-rain-copy">
            <strong class="tc-coin-rain-title">{{ t('center.coinRainTitle') }}</strong>
            <span class="tc-coin-rain-description">
              <span>{{ t('center.coinRainDescLead') }}</span>
              <span id="tc-coin-rain-desc" class="tc-coin-rain-max-copy">{{ t('center.coinRainDescMax', { count: 400 }) }}</span>
            </span>
          </span>
          <span id="tc-coin-rain-entry-action" class="tc-coin-rain-entry-action">{{ t('center.coinRainPlay') }}</span>
        </button>
      </section>

      <section id="tc-recent-redemptions-section" class="tc-section" style="display:none;">
        <div class="tc-card tc-recent-redemptions-card">
          <h2 class="tc-recent-redemptions-title">{{ t('center.recentRedemptionsTitle') }}</h2>
          <div id="tc-recent-redemptions-list" class="tc-recent-redemptions-list" />
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

  <div id="tc-coin-rain-overlay" class="tc-coin-rain-overlay" style="display:none;">
    <button id="tc-coin-rain-leave" type="button" class="tc-coin-rain-leave" :aria-label="t('common.close')">×</button>
    <div class="tc-coin-rain-hud">
      <span class="tc-coin-rain-hud-time"><span aria-hidden="true">◷</span><strong id="tc-coin-rain-time">00:30</strong></span>
      <span class="tc-coin-rain-hud-track"><i id="tc-coin-rain-game-progress" /></span>
      <strong class="tc-coin-rain-hud-coins"><img :src="assetUrl('icons/coin-rain-gold-coin.svg')" alt="" width="22" height="22"><span id="tc-coin-rain-collected">0</span></strong>
    </div>
    <div id="tc-coin-rain-countdown" class="tc-coin-rain-countdown">
      <div class="tc-coin-rain-countdown-logo">
        <i class="tc-coin-rain-countdown-glow" aria-hidden="true" />
        <i class="tc-coin-rain-countdown-confetti" aria-hidden="true" />
        <span class="tc-coin-rain-countdown-coins" aria-hidden="true">
          <img class="tc-coin-rain-countdown-coin tc-coin-rain-countdown-coin--1" :src="assetUrl('icons/coin-rain-gold-coin.svg')" alt="" width="44" height="44">
          <img class="tc-coin-rain-countdown-coin tc-coin-rain-countdown-coin--2" :src="assetUrl('icons/coin-rain-gold-coin.svg')" alt="" width="34" height="34">
          <img class="tc-coin-rain-countdown-coin tc-coin-rain-countdown-coin--3" :src="assetUrl('icons/coin-rain-gold-coin.svg')" alt="" width="28" height="28">
          <img class="tc-coin-rain-countdown-coin tc-coin-rain-countdown-coin--4" :src="assetUrl('icons/coin-rain-gold-coin.svg')" alt="" width="40" height="40">
          <img class="tc-coin-rain-countdown-coin tc-coin-rain-countdown-coin--5" :src="assetUrl('icons/coin-rain-gold-coin.svg')" alt="" width="30" height="30">
          <img class="tc-coin-rain-countdown-coin tc-coin-rain-countdown-coin--6" :src="assetUrl('icons/coin-rain-gold-coin.svg')" alt="" width="36" height="36">
          <img class="tc-coin-rain-countdown-coin tc-coin-rain-countdown-coin--7" :src="assetUrl('icons/coin-rain-gold-coin.svg')" alt="" width="26" height="26">
        </span>
        <strong class="tc-coin-rain-countdown-title">COIN RAIN</strong>
        <span id="tc-coin-rain-countdown-max" class="tc-coin-rain-countdown-badge">UP TO <em>400</em> COINS!</span>
      </div>
      <b id="tc-coin-rain-countdown-value" class="tc-coin-rain-countdown-value">3</b>
    </div>
    <div id="tc-coin-rain-stage" class="tc-coin-rain-stage" />
    <div id="tc-coin-rain-multiplier" class="tc-coin-rain-multiplier" aria-hidden="true"><span id="tc-coin-rain-multiplier-value">x0</span></div>

    <div id="tc-coin-rain-leave-dialog" class="tc-coin-rain-leave-dialog" style="display:none;">
      <div class="tc-coin-rain-leave-card">
        <button id="tc-coin-rain-leave-close" type="button" class="tc-coin-rain-dialog-close" :aria-label="t('common.close')">×</button>
        <img :src="assetUrl('images/coin-rain-leave-art.png')" alt="" class="tc-coin-rain-leave-art" width="174" height="104">
        <h2>{{ t('center.coinRainLeaveTitle') }}</h2>
        <p id="tc-coin-rain-leave-desc">{{ t('center.coinRainLeaveDesc') }}</p>
        <button id="tc-coin-rain-continue" type="button" class="tc-coin-rain-dialog-primary">{{ t('center.coinRainContinue') }}</button>
        <button id="tc-coin-rain-confirm-leave" type="button" class="tc-coin-rain-dialog-secondary">{{ t('center.coinRainLeave') }}</button>
      </div>
    </div>
  </div>

  <div id="tc-coin-rain-joined-dialog" class="tc-modal-overlay" style="display:none;">
    <div class="tc-coin-rain-joined-card">
      <button id="tc-coin-rain-joined-close" type="button" class="tc-coin-rain-dialog-close" :aria-label="t('common.close')">×</button>
      <img
        :src="assetUrl('images/coin-rain-leave-art.png')"
        alt=""
        class="tc-coin-rain-joined-art"
        width="168"
        height="100"
      >
      <h2 id="tc-coin-rain-joined-title">{{ t('center.coinRainAlreadyJoinedTitle') }}</h2>
      <p id="tc-coin-rain-joined-desc">{{ t('center.coinRainAlreadyJoinedDesc') }}</p>
      <button id="tc-coin-rain-joined-ok" type="button" class="tc-coin-rain-dialog-primary">{{ t('center.coinRainOk') }}</button>
    </div>
  </div>

  <div id="tc-coin-rain-result" class="tc-modal-overlay" style="display:none;">
    <div class="tc-coin-rain-result-card">
      <button id="tc-coin-rain-result-close" type="button" class="tc-coin-rain-dialog-close" :aria-label="t('common.close')">×</button>
      <div class="tc-coin-rain-result-hero">
        <img
          id="tc-coin-rain-result-hero-img"
          :src="assetUrl('images/coin-rain-reward-art.png')"
          alt=""
          width="220"
          height="140"
        >
      </div>
      <h2 id="tc-coin-rain-result-title">{{ t('center.coinRainRewardTitle') }}</h2>
      <div id="tc-coin-rain-result-amount" class="tc-coin-rain-result-amount">+0</div>
      <div id="tc-coin-rain-result-unit" class="tc-coin-rain-result-unit">{{ t('common.coins') }}</div>
      <p id="tc-coin-rain-result-copy" class="tc-coin-rain-result-copy"></p>
      <div id="tc-coin-rain-boost-offer" class="tc-coin-rain-boost-offer">
        <span class="tc-coin-rain-video-icon" aria-hidden="true">▶</span>
        <span><small>{{ t('center.coinRainWatchShortVideo') }}</small><strong id="tc-coin-rain-boost-offer-copy"></strong></span>
      </div>
      <button id="tc-coin-rain-watch-ad" type="button" class="tc-primary-btn tc-primary-btn--full">{{ t('center.coinRainWatchAd') }}</button>
      <button id="tc-coin-rain-claim" type="button" class="tc-coin-rain-claim">{{ t('center.coinRainClaim') }}</button>
    </div>
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

  <div id="checkinChestModal" class="checkin-chest-overlay" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="checkinChestHeading">
    <div class="checkin-chest-card">
      <img :src="assetUrl('images/checkin-chest-hero.png')" alt="" class="checkin-chest-hero" width="450" height="304">
      <div class="checkin-chest-copy">
        <h2 id="checkinChestHeading" class="checkin-chest-headline">{{ t('center.checkinChestDropped') }}</h2>
        <p class="checkin-chest-desc">{{ t('center.checkinChestDescLine1') }}<br>{{ t('center.checkinChestDescLine2') }}</p>
      </div>
      <div class="checkin-chest-actions">
        <button id="checkinChestWatchBtn" type="button" class="checkin-chest-primary"><img :src="assetUrl('icons/video_outline.svg')" alt="" width="28" height="28">{{ t('center.checkinChestWatchVideo') }}</button>
        <button id="checkinChestDismissBtn" type="button" class="checkin-chest-secondary">{{ t('center.checkinChestDismiss') }}</button>
      </div>
    </div>
  </div>

  <div id="checkinChestRewardModal" class="checkin-chest-result-overlay" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="checkinChestRewardHeading">
    <div class="checkin-chest-result-card">
      <button id="checkinChestRewardClose" type="button" class="checkin-chest-result-close" :aria-label="t('common.close')">×</button>
      <img :src="assetUrl('images/checkin-chest-reward-hero.png')" alt="" class="checkin-chest-result-hero" width="420" height="350">
      <div class="checkin-chest-result-copy">
        <h2 id="checkinChestRewardHeading" class="checkin-chest-result-title"><span aria-hidden="true">🎉</span> {{ t('center.checkinChestCongratulations') }}</h2>
        <p class="checkin-chest-result-subtitle">{{ t('center.checkinChestYouGot') }}</p>
        <p class="checkin-chest-result-amount"><strong id="checkinChestRewardCoins">+0</strong> <span>{{ t('common.coins') }}</span></p>
      </div>
      <button id="checkinChestRewardClaimBtn" type="button" class="checkin-chest-result-claim">{{ t('center.checkinChestClaim') }}</button>
    </div>
  </div>

  <div id="checkinPromptModal" class="checkin-prompt-overlay" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="checkinPromptTitle">
    <div class="checkin-prompt-card">
      <button id="checkinPromptClose" type="button" class="checkin-prompt-close" :aria-label="t('common.close')">×</button>
      <div class="checkin-prompt-hero">
        <span class="checkin-prompt-spark checkin-prompt-spark--left" aria-hidden="true">✦</span>
        <span class="checkin-prompt-spark checkin-prompt-spark--right" aria-hidden="true">✦</span>
        <h2 id="checkinPromptTitle" class="checkin-prompt-title">{{ t('center.checkinNow') }}</h2>
      </div>
      <div id="checkinPromptDays" class="checkin-prompt-days" />
      <button id="checkinPromptClaim" type="button" class="checkin-prompt-claim">
        <img :src="assetUrl('icons/gold-coin-white.svg')" alt="" width="24" height="24">
        <span>{{ t('center.checkinNow') }}</span>
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
