<script setup>
import { onMounted } from "vue";
import "../assets/topup-status.css";
import { showChunkLoadError } from "../lib/chunk-load-error.js";

onMounted(async () => {
  try {
    const { bootstrapTopupStatus } = await import("../lib/topup-status.js");
    bootstrapTopupStatus();
  } catch (error) {
    console.error("[TopupStatus] Failed to load page module", error);
    showChunkLoadError("Top-up Status");
  }
});
</script>

<template>
  <div class="ts-root" data-status="pending">
    <header id="tsHeader" class="ts-header">
      <button id="tsBackBtn" type="button" class="ts-back-btn" aria-label="Back">←</button>
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

      <button id="tsReturnBtn" type="button" class="ts-secondary-btn">
        <span id="tsSecondaryActionLabel">Return to Tasks</span>
      </button>
    </main>
  </div>

  <div id="toast" class="toast" style="display:none;" />
</template>
