<script setup>
import "../assets/gold-coins-exchange.css";
import { assetUrl } from "../lib/asset-url.js";
import { ROUTE_NAMES } from "../lib/activity-pages.js";
import { useLazyActivityPage } from "../composables/useLazyActivityPage.js";
import { useActivityBackNavigation } from "../composables/useActivityBackNavigation.js";
import { useI18n } from "../composables/useI18n.js";

const { t } = useI18n();
const { returnToActivityCenter } = useActivityBackNavigation();

useLazyActivityPage(ROUTE_NAMES.GOLD_COINS_EXCHANGE, {
  logTag: "GoldCoinsExchange",
  loadModule: () => import("../boot/initGoldCoinsExchange.js"),
  bootstrap: (module, ctx) => module.initGoldCoinsExchange(ctx),
});
</script>

<template>
  <div class="redeem-root">
    <header class="redeem-header">
      <button id="backBtn" type="button" class="redeem-back-btn" :aria-label="t('common.back')" @click="returnToActivityCenter">←</button>
    </header>

    <main class="redeem-main">
      <section class="redeem-section">
        <div class="redeem-wallet-card">
          <div class="redeem-wallet-left">
              <div class="redeem-wallet-label">{{ t('redeem.myCoins') }}</div>
              <div class="redeem-wallet-value">
                <span id="userGoldCoins">0</span>
                <span class="redeem-wallet-unit">{{ t('common.goldCoins') }}</span>
              </div>
              <div class="redeem-wallet-hint">{{ t('redeem.walletHint') }}</div>
            </div>
            <div class="redeem-wallet-icon">
              <img :src="assetUrl('icons/gold-coin-white.svg')" alt="coins" class="icon-img">
            </div>
        </div>
      </section>

      <section class="redeem-section">
        <h2 class="redeem-section-title">{{ t('redeem.sectionTitle') }}</h2>

        <div class="redeem-field">
          <label class="redeem-label" for="inputMobile">{{ t('redeem.mobileNumber') }}</label>
          <div class="redeem-input-wrapper">
            <button
              id="countryCodeBtn"
              type="button"
              class="redeem-countrycode-btn"
              :aria-label="t('redeem.countryCode')"
              aria-haspopup="listbox"
              aria-expanded="false"
            >
              <span class="redeem-countrycode-flag" aria-hidden="true">🇮🇳</span>
              <span class="redeem-countrycode-dial">+91</span>
              <span class="redeem-countrycode-chevron" aria-hidden="true">▾</span>
            </button>
            <div id="countryCodeDropdown" class="redeem-countrycode-dropdown" role="listbox" hidden />
            <input
              id="inputMobile"
              class="redeem-input"
              type="tel"
              inputmode="numeric"
              maxlength="15"
              :placeholder="t('redeem.phonePlaceholder')"
            />
          </div>
        </div>

        <div id="operatorSection" class="redeem-field" style="display:none;">
          <label class="redeem-label">{{ t('redeem.operator') }}</label>
          <div id="operatorGrid" class="redeem-operator-grid" />
        </div>

        <div id="amountSection" class="redeem-field" style="display:none;">
          <label class="redeem-label">{{ t('redeem.selectAmount') }}</label>
          <div id="amountGrid" class="redeem-amount-grid" />
        </div>

        <div id="redeemSummary" class="redeem-summary">
          {{ t('redeem.summaryDefault') }}
        </div>

        <button id="btnRedeem" type="button" class="redeem-primary-btn redeem-primary-btn--disabled" disabled>
          {{ t('redeem.redeemNow') }}
        </button>
        <p class="redeem-powered">
          <span class="redeem-powered-label">{{ t('redeem.poweredBy') }}</span>
          <span class="redeem-powered-brand">DingConnect</span>
        </p>
      </section>

      <section class="redeem-section redeem-history-section">
        <div class="redeem-history-header">
          <h2 class="redeem-section-title">{{ t('redeem.historyTitle') }}</h2>
          <button id="viewAllRecords" type="button" class="redeem-history-view-all">{{ t('redeem.viewAll') }}</button>
        </div>
        <div id="historyList" class="redeem-history-list" />
      </section>
    </main>
  </div>

  <div id="exchangeModal" class="modal" style="display: none;">
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title">{{ t('redeem.confirmTitle') }}</h2>
        <button id="modalCloseBtn" type="button" class="modal-close" :aria-label="t('common.close')">✕</button>
      </div>
      <div class="modal-body">
        <div class="product-preview">
          <div id="previewIcon" class="preview-icon" />
          <div class="preview-info">
            <div id="previewName" class="preview-name" />
            <div id="previewPoints" class="preview-points" />
          </div>
        </div>
        <div class="modal-message">
          <p>{{ t('redeem.confirmPrefix') }}<span id="confirmPoints"></span>{{ t('redeem.confirmInfix') }}<span id="confirmName"></span>{{ t('redeem.confirmSuffix') }}</p>
        </div>
      </div>
      <div class="modal-footer">
        <button id="cancelBtn" type="button" class="btn-cancel">{{ t('common.cancel') }}</button>
        <button id="confirmBtn" type="button" class="btn-confirm">{{ t('common.confirm') }}</button>
      </div>
    </div>
  </div>
</template>
