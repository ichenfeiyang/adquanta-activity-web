<script setup>
import { useRoute, useRouter } from "vue-router";
import "../assets/topup-status.css";
import { ROUTE_NAMES } from "../lib/activity-pages.js";
import { useLazyActivityPage } from "../composables/useLazyActivityPage.js";
import { useActivityBackNavigation } from "../composables/useActivityBackNavigation.js";
import { useI18n } from "../composables/useI18n.js";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { returnToMobileTopup } = useActivityBackNavigation();

useLazyActivityPage(ROUTE_NAMES.TOPUP_STATUS, {
  logTag: "TopupStatus",
  loadModule: () => import("../boot/initTopupStatus.js"),
  bootstrap: (module, ctx) => module.initTopupStatus(ctx),
});
</script>

<template>
  <div class="ts-root" data-status="pending">
    <header id="tsHeader" class="ts-header">
      <button id="tsBackBtn" type="button" class="ts-back-btn" :aria-label="t('common.back')" @click="returnToMobileTopup">←</button>
    </header>

    <main class="ts-main">
      <section class="ts-status-card">
        <div class="ts-status-icon-wrap">
          <div id="tsStatusIcon" class="ts-status-icon">↻</div>
        </div>
        <h2 id="tsStatusTitle" class="ts-status-title">{{ t('topup.processingTitle') }}</h2>
        <p id="tsStatusDesc" class="ts-status-desc">{{ t('topup.processingDesc') }}</p>
      </section>

      <section class="ts-detail-card">
        <div class="ts-row">
          <span class="ts-label">{{ t('topup.transactionId') }}</span>
          <span id="tsTransactionId" class="ts-value">-</span>
        </div>
        <div class="ts-divider" />
        <div class="ts-row">
          <span class="ts-label">{{ t('topup.amount') }}</span>
          <span id="tsAmount" class="ts-value">-</span>
        </div>
        <div class="ts-row">
          <span class="ts-label">{{ t('topup.mobileNumber') }}</span>
          <span id="tsPhone" class="ts-value">-</span>
        </div>
        <div class="ts-row">
          <span class="ts-label">{{ t('topup.operator') }}</span>
          <span id="tsOperator" class="ts-value">-</span>
        </div>
      </section>

      <section id="tsTipCard" class="ts-tip-card">
        <div class="ts-tip-icon">🕒</div>
        <div>
          <div class="ts-tip-title">{{ t('topup.avgTimeTitle') }}</div>
          <div class="ts-tip-desc">{{ t('topup.avgTimeDesc') }}</div>
        </div>
      </section>

      <button id="tsReturnBtn" type="button" class="ts-secondary-btn" @click="returnToMobileTopup">
        <span id="tsSecondaryActionLabel">{{ t('topup.returnToTasks') }}</span>
      </button>
    </main>
  </div>
</template>
