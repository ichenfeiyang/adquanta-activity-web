<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import "../assets/feedback.css";
import { postActivityFeedback } from "../lib/activity-api.js";
import { FEEDBACK_PAGE_ID } from "../lib/activity-analytics.js";
import { requireActivitySession } from "../lib/activity-session.js";
import { goToActivityCenter, goToFeedbackSuccess } from "../lib/activity-navigation.js";
import { getActivityLocale } from "../lib/i18n/activity-locale.js";
import { useI18n } from "../composables/useI18n.js";
import { assetUrl } from "../lib/asset-url.js";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const session = requireActivitySession(route, { router });
const content = ref("");
const contactEmail = ref("");
const emailError = ref("");
const submitting = ref(false);
const error = ref("");
const remaining = computed(() => Math.max(0, 300 - [...content.value].length));

function newRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const value = Math.floor(Math.random() * 16);
    return (token === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}
// Reuse one request id until success so retries stay idempotent.
const clientRequestId = ref(newRequestId());
const contactEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateContactEmail() {
  const value = contactEmail.value.trim();
  emailError.value = value && !contactEmailPattern.test(value) ? t("feedback.emailInvalid") : "";
  return !emailError.value;
}

function track(event, data = {}) {
  window.ActivityBridgeHelper?.trackEvent?.(event, { page_id: FEEDBACK_PAGE_ID, ...data });
}
function back() {
  goToActivityCenter(router, String(route.query.activity_id || ""));
}

async function submit() {
  const value = content.value.trim();
  if (!value) {
    error.value = t("feedback.contentRequired");
    track("rewards_feedback_submit_fail", {
      element_id: "submit_feedback_button",
      reason: "empty_content",
    });
    return;
  }
  const normalizedEmail = contactEmail.value.trim();
  if (!validateContactEmail()) {
    error.value = emailError.value;
    track("rewards_feedback_submit_fail", {
      element_id: "submit_feedback_button",
      reason: "invalid_contact_email",
    });
    return;
  }
  if (!session || submitting.value) return;
  track("rewards_feedback_submit_click", {
    element_id: "submit_feedback_button",
    element_name: "点击反馈页面提交反馈按钮",
  });
  submitting.value = true;
  error.value = "";
  try {
    const result = await postActivityFeedback(session.apiOptions, {
      content: value,
      contactEmail: normalizedEmail,
      locale: getActivityLocale(),
      clientRequestId: clientRequestId.value,
    });
    if (result?.code !== 200) throw new Error(result?.message || t("feedback.submitFailed"));
    clientRequestId.value = newRequestId();
    track("rewards_feedback_submit_success", {
      element_id: "submit_feedback_button",
    });
    goToFeedbackSuccess(router, session.activityId);
  } catch (e) {
    error.value = e?.message || t("feedback.submitFailed");
    track("rewards_feedback_submit_fail", {
      element_id: "submit_feedback_button",
      reason: error.value,
    });
  } finally {
    submitting.value = false;
  }
}

onMounted(() => track("page_view"));
</script>

<template>
  <div class="feedback-root">
    <header class="feedback-header">
      <button type="button" class="feedback-back" :aria-label="t('common.back')" @click="back">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m15 5-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <h1 class="feedback-title">{{ t("feedback.title") }}</h1>
    </header>

    <main class="feedback-main">
      <section class="feedback-hero">
        <div class="feedback-hero-copy">
          <h2>{{ t("feedback.heroTitle") }}</h2>
          <p>{{ t("feedback.heroDesc") }}</p>
        </div>
        <img
          :src="assetUrl('images/feedback-hero-illustration.png')"
          class="feedback-hero-art"
          alt=""
          width="170"
          height="170"
          loading="eager"
          decoding="async"
        >
      </section>

      <form class="feedback-form" @submit.prevent="submit">
        <section class="feedback-card feedback-description-card">
          <label class="feedback-label" for="feedback-content">{{ t("feedback.describe") }}</label>
          <textarea
            id="feedback-content"
            v-model="content"
            class="feedback-textarea"
            maxlength="300"
            :placeholder="t('feedback.placeholder')"
          />
          <p class="feedback-counter">{{ 300 - remaining }} / 300</p>
        </section>

        <section class="feedback-card feedback-email-card">
          <label class="feedback-email-label" for="feedback-contact-email">
            <span>{{ t("feedback.contactEmail") }}</span>
            <span class="feedback-email-optional">({{ t("feedback.optional") }})</span>
          </label>
          <div class="feedback-email-field" :class="{ 'feedback-email-field--error': emailError }">
            <svg class="feedback-email-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="1.5" stroke="currentColor" stroke-width="1.8" />
              <path d="m4.5 6.5 7.5 6 7.5-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          <input
            id="feedback-contact-email"
            v-model="contactEmail"
            class="feedback-email-input"
            :class="{ 'feedback-email-input--error': emailError }"
            type="email"
            inputmode="email"
            autocomplete="email"
            maxlength="254"
            :placeholder="t('feedback.contactEmailPlaceholder')"
            @blur="validateContactEmail"
            @input="emailError && validateContactEmail()"
          >
          </div>
          <p class="feedback-email-hint">{{ t("feedback.contactEmailHint") }}</p>
          <p v-if="emailError" class="feedback-email-error">{{ emailError }}</p>
        </section>

        <p v-if="error" class="feedback-error">{{ error }}</p>
        <button class="feedback-submit" type="submit" :disabled="submitting">
          {{ submitting ? t("feedback.submitting") : t("feedback.submit") }}
        </button>
      </form>
    </main>
  </div>
</template>
