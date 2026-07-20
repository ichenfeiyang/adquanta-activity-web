<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import "../assets/feedback.css";
import { postActivityFeedback } from "../lib/activity-api.js";
import { requireActivitySession } from "../lib/activity-session.js";
import { goToActivityCenter, goToFeedbackSuccess } from "../lib/activity-navigation.js";
import { getActivityLocale } from "../lib/i18n/activity-locale.js";
import { useI18n } from "../composables/useI18n.js";
import { assetUrl } from "../lib/asset-url.js";

const route = useRoute(); const router = useRouter(); const { t } = useI18n();
const session = requireActivitySession(route, { router });
const content = ref(""); const files = ref([]); const submitting = ref(false); const error = ref("");
const remaining = computed(() => Math.max(0, 300 - [...content.value].length));
const inputId = "feedback-image-input";
function track(event, data = {}) { window.ActivityBridgeHelper?.trackEvent?.(event, { page_id: "rewards_feedback", ...data }); }
function newRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const value = Math.floor(Math.random() * 16); return (token === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}
function back() { goToActivityCenter(router, String(route.query.activity_id || "")); }
function removeImage(index) { URL.revokeObjectURL(files.value[index].preview); files.value.splice(index, 1); }
function selectImages(event) {
  error.value = "";
  for (const file of Array.from(event.target.files || [])) {
    if (files.value.length >= 3) break;
    if (!['image/jpeg','image/png'].includes(file.type) || file.size > 10 * 1024 * 1024) { error.value = t('feedback.imageInvalid'); continue; }
    files.value.push({ file, preview: URL.createObjectURL(file) });
  }
  event.target.value = "";
}
async function submit() {
  const value = content.value.trim(); track('rewards_feedback_submit_click', { element_id: 'submit_feedback_button', element_name: '点击反馈页面提交反馈按钮' });
  if (!value) { error.value = t('feedback.contentRequired'); return; }
  if (!session || submitting.value) return;
  submitting.value = true; error.value = "";
  try {
    const result = await postActivityFeedback(session.apiOptions, { content: value, images: files.value.map((item) => item.file), locale: getActivityLocale(), clientRequestId: newRequestId() });
    if (result?.code !== 200) throw new Error(result?.message || t('feedback.submitFailed'));
    goToFeedbackSuccess(router, session.activityId);
  } catch (e) { error.value = e?.message || t('feedback.submitFailed'); } finally { submitting.value = false; }
}
onMounted(() => track('page_view', { page_id: 'rewards_feedback' }));
onUnmounted(() => files.value.forEach((item) => URL.revokeObjectURL(item.preview)));
</script>
<template>
  <div class="feedback-root">
    <header class="feedback-header">
      <button type="button" class="feedback-back" :aria-label="t('common.back')" @click="back">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m15 5-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <h1 class="feedback-title">{{ t('feedback.title') }}</h1>
    </header>

    <main class="feedback-main">
      <section class="feedback-hero">
        <div class="feedback-hero-copy">
          <h2>{{ t('feedback.heroTitle') }}</h2>
          <p>{{ t('feedback.heroDesc') }}</p>
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
          <label class="feedback-label" for="feedback-content">{{ t('feedback.describe') }}</label>
          <textarea
            id="feedback-content"
            v-model="content"
            class="feedback-textarea"
            maxlength="300"
            :placeholder="t('feedback.placeholder')"
          />
          <p class="feedback-counter">{{ 300 - remaining }} / 300</p>
        </section>

        <section class="feedback-card feedback-upload-card">
          <h2 class="feedback-upload-title">
            {{ t('feedback.uploadTitle') }}
            <span>{{ t('feedback.optional') }}</span>
          </h2>
          <p class="feedback-upload-hint">{{ t('feedback.imageHint') }}</p>
          <div class="feedback-images">
            <label v-if="files.length < 3" class="feedback-upload" :for="inputId">
              <span class="feedback-upload-plus">＋</span>
              <span class="feedback-upload-copy">+ {{ t('feedback.addImage') }}</span>
              <input :id="inputId" type="file" accept="image/jpeg,image/png" multiple @change="selectImages">
            </label>
            <div v-for="(item,index) in files" :key="item.preview" class="feedback-image-item">
              <img :src="item.preview" alt="">
              <button type="button" class="feedback-image-remove" :aria-label="t('common.close')" @click="removeImage(index)">×</button>
            </div>
          </div>
        </section>

        <p v-if="error" class="feedback-error">{{ error }}</p>
        <button class="feedback-submit" type="submit" :disabled="submitting">
          {{ submitting ? t('feedback.submitting') : t('feedback.submit') }}
        </button>
      </form>
    </main>
  </div>
</template>
