<script setup>
import { useRoute, useRouter } from "vue-router";
import "../assets/topup-status.css";
import { ROUTE_NAMES } from "../lib/activity-pages.js";
import { useLazyActivityPage } from "../composables/useLazyActivityPage.js";
import { useActivityBackNavigation } from "../composables/useActivityBackNavigation.js";

const route = useRoute();
const router = useRouter();
const { returnToActivityCenter, navigateBackOrActivityCenter } = useActivityBackNavigation();

useLazyActivityPage(ROUTE_NAMES.TOPUP_STATUS, {
  logTag: "TopupStatus",
  loadModule: () => import("../boot/initTopupStatus.js"),
  bootstrap: (module, ctx) => module.initTopupStatus(ctx),
});
</script>

<template>
  <div class="ts-root" data-status="pending">
    <header id="tsHeader" class="ts-header">
      <button id="tsBackBtn" type="button" class="ts-back-btn" aria-label="Back" @click="navigateBackOrActivityCenter">←</button>
    </header>

    <main class="ts-main">
      <section class="ts-status-card">
        <div class="ts-status-icon-wrap">
          <div id="tsStatusIcon" class="ts-status-icon">↻</div>
        </div>
        <h2 id="tsStatusTitle" class="ts-status-title">Processing Recharge</h2>
        <p id="tsStatusDesc" class="ts-status-desc">We are processing your top-up. This may take a few minutes.</p>
      </section>

      <section class="ts-detail-card">
        <div class="ts-row">
          <span class="ts-label">Transaction ID</span>
          <span id="tsTransactionId" class="ts-value">-</span>
        </div>
        <div class="ts-divider" />
        <div class="ts-row">
          <span class="ts-label">Amount</span>
          <span id="tsAmount" class="ts-value">-</span>
        </div>
        <div class="ts-row">
          <span class="ts-label">Mobile Number</span>
          <span id="tsPhone" class="ts-value">-</span>
        </div>
        <div class="ts-row">
          <span class="ts-label">Operator</span>
          <span id="tsOperator" class="ts-value">-</span>
        </div>
      </section>

      <section id="tsTipCard" class="ts-tip-card">
        <div class="ts-tip-icon">🕒</div>
        <div>
          <div class="ts-tip-title">Average Processing Time</div>
          <div class="ts-tip-desc">Typically under 2 minutes.</div>
        </div>
      </section>

      <button id="tsReturnBtn" type="button" class="ts-secondary-btn" @click="returnToActivityCenter">
        <span id="tsSecondaryActionLabel">Return to Tasks</span>
      </button>
    </main>
  </div>
</template>
