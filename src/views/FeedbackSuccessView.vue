<script setup>
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import "../assets/feedback.css";
import { useI18n } from "../composables/useI18n.js";
import { FEEDBACK_PAGE_ID } from "../lib/activity-analytics.js";
import { goToActivityCenter } from "../lib/activity-navigation.js";
import { assetUrl } from "../lib/asset-url.js";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

function back() {
  goToActivityCenter(router, String(route.query.activity_id || ""));
}

onMounted(() => {
  window.ActivityBridgeHelper?.trackEvent?.("page_view", {
    page_id: FEEDBACK_PAGE_ID,
    element_id: "feedback_success",
  });
});
</script>

<template>
  <div class="feedback-root">
    <header class="feedback-header">
      <button type="button" class="feedback-back" :aria-label="t('common.back')" @click="back">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m15 5-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <h1 class="feedback-title">{{ t('feedback.submittedTitle') }}</h1>
    </header>

    <main class="feedback-success">
      <img
        :src="assetUrl('images/feedback-success-illustration.png')"
        class="feedback-success-art"
        alt=""
        width="240"
        height="140"
        loading="eager"
        decoding="async"
      />
      <h2>{{ t('feedback.submittedTitle') }}</h2>
      <p>{{ t('feedback.submittedDesc') }}</p>
      <button class="feedback-submit" type="button" @click="back">
        {{ t('feedback.back') }}
      </button>
    </main>
  </div>
</template>
