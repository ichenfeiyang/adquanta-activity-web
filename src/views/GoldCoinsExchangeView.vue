<script setup>
import { ref } from "vue";
import "../assets/gold-coins-exchange.css";
import { assetUrl } from "../lib/asset-url.js";
import { ROUTE_NAMES } from "../lib/activity-pages.js";
import { useLazyActivityPage } from "../composables/useLazyActivityPage.js";
import { useActivityBackNavigation } from "../composables/useActivityBackNavigation.js";
import { useI18n } from "../composables/useI18n.js";

const { t } = useI18n();
const { returnToActivityCenter } = useActivityBackNavigation();
const privacyPolicyOpen = ref(false);

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
      <h1 class="redeem-header-title">{{ t('redeem.pageTitle') }}</h1>
    </header>

    <main class="redeem-main">
      <section class="redeem-section">
        <div class="redeem-wallet-card">
          <div class="redeem-wallet-top">
            <img :src="assetUrl('icons/gold_coin.svg')" alt="" class="redeem-wallet-top-icon" width="18" height="18">
            <span class="redeem-wallet-label">{{ t('redeem.totalBalance') }}</span>
          </div>
          <div class="redeem-wallet-value-row">
            <span id="userGoldCoins" class="redeem-wallet-value">0</span>
            <span class="redeem-wallet-unit">{{ t('common.goldCoins') }}</span>
          </div>
        </div>
      </section>

      <section class="redeem-section">
        <div class="redeem-tabs" role="tablist" :aria-label="t('redeem.tabListLabel')">
          <button
            id="tabGiftCards"
            type="button"
            class="redeem-tab"
            role="tab"
            aria-selected="true"
            aria-controls="giftCardPanel"
          >
            {{ t('redeem.tabGiftCards') }}
          </button>
          <button
            id="tabMobileTopup"
            type="button"
            class="redeem-tab"
            role="tab"
            aria-selected="false"
            aria-controls="mobileTopupPanel"
          >
            {{ t('redeem.tabMobileTopup') }}
          </button>
        </div>
      </section>

      <section id="giftCardPanel" class="redeem-tab-panel" role="tabpanel" aria-labelledby="tabGiftCards">
        <div class="redeem-field redeem-gift-country-field">
          <label class="redeem-label">{{ t('redeem.selectCountry') }}</label>
          <div class="redeem-gift-country-wrapper">
            <button
              id="giftCountryBtn"
              type="button"
              class="redeem-gift-country-btn"
              aria-haspopup="listbox"
              aria-expanded="false"
            >
              <span class="redeem-countrycode-flag" aria-hidden="true">🇮🇳</span>
              <span class="redeem-gift-country-name">{{ t('redeem.countryIN') }}</span>
              <span class="redeem-gift-country-chevron" aria-hidden="true">⌄</span>
            </button>
            <div id="giftCountryDropdown" class="redeem-countrycode-dropdown redeem-gift-country-dropdown" role="listbox" hidden />
          </div>
        </div>

        <div id="giftCurrencyField" class="redeem-field redeem-gift-currency-field" hidden>
          <label class="redeem-label">{{ t('redeem.selectCurrency') }}</label>
          <div class="redeem-gift-country-wrapper">
            <button
              id="giftCurrencyBtn"
              type="button"
              class="redeem-gift-country-btn"
              aria-haspopup="listbox"
              aria-expanded="false"
            >
              <span class="redeem-gift-currency-symbol" aria-hidden="true">₹</span>
              <span class="redeem-gift-country-name">INR - Indian Rupee</span>
              <span class="redeem-gift-country-chevron" aria-hidden="true">⌄</span>
            </button>
            <div id="giftCurrencyDropdown" class="redeem-countrycode-dropdown redeem-gift-country-dropdown" role="listbox" hidden />
          </div>
        </div>

        <div class="redeem-featured-head">
          <span class="redeem-featured-icon" aria-hidden="true">★</span>
          <h2 class="redeem-section-title">{{ t('redeem.featuredRewards') }}</h2>
        </div>

        <div class="redeem-field">
          <label class="redeem-label">{{ t('redeem.selectBrand') }}</label>
          <div id="giftBrandGrid" class="redeem-brand-grid" role="listbox" :aria-label="t('redeem.selectBrand')" />
        </div>

        <div id="giftAmountSection" class="redeem-field">
          <label class="redeem-label">{{ t('redeem.selectVoucherValue') }}</label>
          <div id="giftAmountGrid" class="redeem-gift-amount-grid" />
        </div>

        <div id="giftRecipientSection" class="redeem-field">
          <div id="giftRecipientSkeleton" class="redeem-gift-recipient-skeleton" hidden />
          <div id="giftRecipientForm">
            <div class="redeem-recipient-title-row">
              <span class="redeem-recipient-title-icon" aria-hidden="true"></span>
              <h2 class="redeem-section-title">{{ t('redeem.recipientInformation') }}</h2>
            </div>
            <label class="redeem-label" for="inputGiftRecipientName">{{ t('redeem.recipientName') }}</label>
            <input
              id="inputGiftRecipientName"
              class="redeem-input redeem-input--full"
              type="text"
              autocomplete="name"
              maxlength="80"
              :placeholder="t('redeem.recipientNamePlaceholder')"
            />
            <p id="giftRecipientNameError" class="redeem-field-error">
              {{ t('redeem.recipientNameRequired') }}
            </p>

            <label class="redeem-label redeem-label--spaced" for="inputGiftRecipientEmail">{{ t('redeem.recipientEmail') }}</label>
            <input
              id="inputGiftRecipientEmail"
              class="redeem-input redeem-input--full"
              type="email"
              autocomplete="email"
              inputmode="email"
              maxlength="50"
              :placeholder="t('redeem.recipientEmailPlaceholder')"
            />
            <p id="giftRecipientEmailError" class="redeem-field-error">
              {{ t('redeem.recipientEmailRequired') }}
            </p>
            <p class="redeem-field-hint">
              {{ t('redeem.giftDeliveryHint') }} {{ t('redeem.giftDeliveryCompliancePrefix') }}
              <button type="button" class="redeem-privacy-policy-link" @click="privacyPolicyOpen = true">{{ t('redeem.privacyPolicyLink') }}</button>
            </p>
          </div>
        </div>

        <button id="btnGiftRedeem" type="button" class="redeem-primary-btn redeem-primary-btn--disabled" disabled>
          {{ t('redeem.redeemNow') }}
        </button>
        <p class="redeem-powered">
          <span class="redeem-powered-label">{{ t('redeem.poweredBy') }}</span>
          <span class="redeem-powered-brand">Tremendous</span>
        </p>

        <div class="redeem-history-section redeem-gift-history-section">
          <div class="redeem-history-header">
            <h2 class="redeem-section-title">{{ t('redeem.historyTitle') }}</h2>
            <button id="viewAllGiftRecords" type="button" class="redeem-history-view-all">{{ t('redeem.viewAll') }}</button>
          </div>
          <div id="giftHistoryList" class="redeem-history-list" />
        </div>
      </section>

      <section id="mobileTopupPanel" class="redeem-tab-panel redeem-tab-panel--hidden" role="tabpanel" aria-labelledby="tabMobileTopup" hidden>
        <h2 class="redeem-section-title redeem-section-title--compact">{{ t('redeem.sectionTitle') }}</h2>

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

        <div class="redeem-history-section">
          <div class="redeem-history-header">
            <h2 class="redeem-section-title">{{ t('redeem.historyTitle') }}</h2>
            <button id="viewAllRecords" type="button" class="redeem-history-view-all">{{ t('redeem.viewAll') }}</button>
          </div>
          <div id="historyList" class="redeem-history-list" />
        </div>
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

  <div v-if="privacyPolicyOpen" class="redeem-privacy-modal" role="dialog" aria-modal="true" :aria-label="t('redeem.privacyPolicyTitle')" @click.self="privacyPolicyOpen = false">
    <section class="redeem-privacy-modal-card">
      <header class="redeem-privacy-modal-header">
        <h2>{{ t('redeem.privacyPolicyTitle') }}</h2>
        <button type="button" class="redeem-privacy-modal-close" :aria-label="t('common.close')" @click="privacyPolicyOpen = false">×</button>
      </header>
      <div class="redeem-privacy-modal-scroll" tabindex="0">
        <p class="redeem-privacy-modal-content">{{ t('redeem.privacyPolicyContent') }}</p>
      </div>
    </section>
  </div>
</template>
