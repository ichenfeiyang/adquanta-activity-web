<script setup>
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import "../assets/gold-coins-exchange.css";
import { assetUrl } from "../lib/asset-url.js";
import { showChunkLoadError } from "../lib/chunk-load-error.js";

const route = useRoute();
const router = useRouter();

onMounted(async () => {
  try {
    const { initGoldCoinsExchange } = await import("../boot/initGoldCoinsExchange.js");
    initGoldCoinsExchange({ router, route });
  } catch (error) {
    console.error("[GoldCoinsExchange] Failed to load page module", error);
    showChunkLoadError("Gold Coins Redeem");
  }
});
</script>

<template>
  <div id="authFailedModal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.55);align-items:center;justify-content:center;padding:20px;">
    <div style="width:100%;max-width:360px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,0.25);">
      <div style="padding:18px 18px 10px;font-weight:800;font-size:16px;color:#111827;">Authorization Failed</div>
      <div style="padding:0 18px 18px;color:#4b5563;font-size:14px;line-height:1.5;">
        Missing token. Please reopen this page from the app and try again.
      </div>
      <div style="padding:0 18px 18px;display:flex;gap:10px;">
        <button id="authFailedOk" type="button" style="flex:1;height:44px;border:none;border-radius:999px;background:linear-gradient(135deg,#ec5b13,#f97316);color:#fff;font-weight:800;cursor:pointer;">OK</button>
      </div>
    </div>
  </div>

  <div class="redeem-root">
    <header class="redeem-header">
      <button id="backBtn" type="button" class="redeem-back-btn" aria-label="Back">←</button>
    </header>

    <main class="redeem-main">
      <section class="redeem-section">
        <div class="redeem-wallet-card">
          <div class="redeem-wallet-left">
            <div class="redeem-wallet-label">My Coins</div>
            <div class="redeem-wallet-value">
              <span id="userGoldCoins">0</span>
              <span class="redeem-wallet-unit">Gold Coins</span>
            </div>
            <div class="redeem-wallet-hint">Use for top-up and more rewards</div>
          </div>
          <div class="redeem-wallet-icon">
            <img :src="assetUrl('icons/gold-coin-white.svg')" alt="coins" class="icon-img">
          </div>
        </div>
      </section>

      <section class="redeem-section">
        <h2 class="redeem-section-title">Mobile Top-up</h2>

        <div class="redeem-field">
          <label class="redeem-label" for="inputMobile">Mobile Number</label>
          <div class="redeem-input-wrapper">
            <button id="countryCodeBtn" type="button" class="redeem-countrycode-btn" aria-label="Country code" disabled>+91</button>
            <input
              id="inputMobile"
              class="redeem-input"
              type="tel"
              inputmode="numeric"
              maxlength="15"
              placeholder="Enter phone number"
            />
          </div>
        </div>

        <div id="operatorSection" class="redeem-field" style="display:none;">
          <label class="redeem-label">Operator</label>
          <div id="operatorGrid" class="redeem-operator-grid" />
        </div>

        <div id="amountSection" class="redeem-field" style="display:none;">
          <label class="redeem-label">Select Amount</label>
          <div id="amountGrid" class="redeem-amount-grid" />
        </div>

        <div id="redeemSummary" class="redeem-summary">
          Select amount to see coins required
        </div>

        <button id="btnRedeem" type="button" class="redeem-primary-btn redeem-primary-btn--disabled" disabled>
          Redeem Now
        </button>
        <p class="redeem-powered">
          <span class="redeem-powered-label">Powered by</span>
          <span class="redeem-powered-brand">DingConnect</span>
        </p>
      </section>

      <section class="redeem-section redeem-history-section">
        <div class="redeem-history-header">
          <h2 class="redeem-section-title">Redemption History</h2>
          <button id="viewAllRecords" type="button" class="redeem-history-view-all">View All</button>
        </div>
        <div id="historyList" class="redeem-history-list" />
      </section>
    </main>
  </div>

  <div id="exchangeModal" class="modal" style="display: none;">
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title">Confirm Redeem</h2>
        <button id="modalCloseBtn" type="button" class="modal-close">✕</button>
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
          <p>Use <span id="confirmPoints"></span> coins to redeem <span id="confirmName"></span>?</p>
        </div>
      </div>
      <div class="modal-footer">
        <button id="cancelBtn" type="button" class="btn-cancel">Cancel</button>
        <button id="confirmBtn" type="button" class="btn-confirm">Confirm</button>
      </div>
    </div>
  </div>

  <div id="toast" class="toast" style="display: none;" />

  <div id="countryCodeModal" class="modal" style="display: none;">
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title">Select country code</h2>
        <button id="countryCodeCloseBtn" type="button" class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="redeem-field" style="margin-top:0;">
          <label class="redeem-label" for="countryCodeSearch">Search</label>
          <div class="redeem-input-wrapper">
            <input id="countryCodeSearch" class="redeem-input" type="text" placeholder="Search country or code (e.g. China, +86)">
          </div>
        </div>
        <div id="countryCodeList" style="margin-top:12px;max-height:320px;overflow:auto;" />
      </div>
    </div>
  </div>
</template>
