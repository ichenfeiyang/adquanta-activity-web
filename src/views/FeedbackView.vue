<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import "../assets/feedback.css";
import { getActivityInfo, postActivityFeedback, postHideRewardsCenter } from "../lib/activity-api.js";
import { FEEDBACK_PAGE_ID } from "../lib/activity-analytics.js";
import { showToast } from "../lib/activity-alert-ui.js";
import {
  getActivityInfoCache,
  invalidateActivityInfoCache,
  loadActivityInfoWithSWR,
} from "../lib/activity-page-cache.js";
import { requireActivitySession } from "../lib/activity-session.js";
import { goToActivityCenter, goToFeedbackSuccess } from "../lib/activity-navigation.js";
import { getActivityLocale } from "../lib/i18n/activity-locale.js";
import { findSupportedRedeemCountry, getSavedRedeemCountryIso } from "../lib/redeem-country.js";
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
const showHideEntry = ref(false);
const hideDialogOpen = ref(false);
const hiding = ref(false);
const hideError = ref("");
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

function feedbackCountryCode() {
  // Prefer an explicit market from the feedback URL, then the user's saved redeem
  // country. Never fall back to India — unknown/missing means "未提供" on BE.
  const query = { ...(session?.routeQuery || {}), ...(route.query || {}) };
  const raw = query.country_code ?? query.countryCode ?? query.country ?? query.region ?? "";
  const fromQuery = findSupportedRedeemCountry(Array.isArray(raw) ? raw[0] : raw)?.iso;
  if (fromQuery) return fromQuery;
  return getSavedRedeemCountryIso();
}

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

function applyRewardsCenterHideInfo(data) {
  showHideEntry.value = data?.rewards_center_hide?.show === true;
}

async function loadRewardsCenterHideInfo() {
  if (!session) return;
  applyRewardsCenterHideInfo(getActivityInfoCache(session.token));
  await loadActivityInfoWithSWR(session.token, {
    fetcher: () => getActivityInfo(session.apiOptions),
    onData: (data) => applyRewardsCenterHideInfo(data),
  });
}

function openHideDialog() {
  hideError.value = "";
  hideDialogOpen.value = true;
  track("rewards_center_hide_entry_click", { element_id: "rewards_center_hide_entry" });
}

function keepRewardsCenter() {
  if (hiding.value) return;
  hideDialogOpen.value = false;
  hideError.value = "";
  track("rewards_center_hide_modal_keep", { element_id: "rewards_center_hide_keep" });
}

async function removeRewardsCenter() {
  if (!session || hiding.value) return;
  track("rewards_center_hide_remove_click", { element_id: "rewards_center_hide_remove" });
  hiding.value = true;
  hideError.value = "";
  try {
    const result = await postHideRewardsCenter(session.apiOptions);
    if (result?.code !== 200 || result?.data?.success !== true) {
      throw new Error(result?.message || t("feedback.hideRemoveFailed"));
    }
    showHideEntry.value = false;
    hideDialogOpen.value = false;
    invalidateActivityInfoCache(session.token);
    showToast(t("feedback.hideRemoveSuccess"), "success");
    track("rewards_center_hide_remove_success", { element_id: "rewards_center_hide_remove" });
  } catch (e) {
    hideError.value = e?.message || t("feedback.hideRemoveFailed");
    track("rewards_center_hide_remove_fail", {
      element_id: "rewards_center_hide_remove",
      reason: hideError.value,
    });
  } finally {
    hiding.value = false;
  }
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
      countryCode: feedbackCountryCode(),
    });
    if (result?.code !== 200) throw new Error(result?.message || t("feedback.submitFailed"));
    clientRequestId.value = newRequestId();
    track("rewards_feedback_submit_success", {
      element_id: "submit_feedback_button",
    });
    goToFeedbackSuccess(router, session.activityId, { countryCode: feedbackCountryCode() });
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

onMounted(() => {
  track("page_view");
  void loadRewardsCenterHideInfo();
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

        <div v-if="showHideEntry" class="feedback-hide-entry">
          <span>{{ t("feedback.hidePrompt") }}</span>
          <button type="button" class="feedback-hide-link" @click="openHideDialog">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.5 10.5 0 0 1 12 4c5.2 0 8.7 4.5 9.5 5.7a4 4 0 0 1 .5 1.1M6.2 6.2C4.4 7.4 3.1 9 2.5 10a3.7 3.7 0 0 0 0 4C3.3 15.3 6.8 20 12 20a10 10 0 0 0 4.1-.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>{{ t("feedback.hideAction") }}</span>
          </button>
        </div>
      </form>
    </main>

    <div v-if="hideDialogOpen" class="feedback-hide-overlay" role="presentation">
      <section
        class="feedback-hide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-hide-title"
        aria-describedby="feedback-hide-description"
      >
        <div class="feedback-hide-dialog-icon" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none">
            <path d="M13 22h38v27a6 6 0 0 1-6 6H19a6 6 0 0 1-6-6V22Z" fill="#ff5a1f" />
            <path d="M10 16h44v10H10z" fill="#ff7a32" />
            <path d="M29 16c-7-2-10-7-7-10 3-3 8 1 10 8 2-7 7-11 10-8 3 3 0 8-7 10" stroke="#ffb33c" stroke-width="5" stroke-linecap="round" />
            <path d="M28 16h8v39h-8z" fill="#ffc14b" />
          </svg>
        </div>
        <h2 id="feedback-hide-title">{{ t("feedback.hideDialogTitle") }}</h2>
        <p id="feedback-hide-description">{{ t("feedback.hideDialogDescription") }}</p>
        <p v-if="hideError" class="feedback-hide-error" role="alert">{{ hideError }}</p>
        <button type="button" class="feedback-hide-remove" :disabled="hiding" @click="removeRewardsCenter">
          {{ hiding ? t("feedback.hideRemoving") : t("feedback.hideRemove") }}
        </button>
        <button type="button" class="feedback-hide-keep" :disabled="hiding" @click="keepRewardsCenter">
          {{ t("feedback.hideKeep") }}
        </button>
      </section>
    </div>
  </div>
</template>
