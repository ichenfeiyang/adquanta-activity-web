<script setup>
import { useRoute, useRouter } from "vue-router";
import "../assets/feedback.css";
import { useI18n } from "../composables/useI18n.js";
import { goToActivityCenter } from "../lib/activity-navigation.js";
const route = useRoute(); const router = useRouter(); const { t } = useI18n();
</script>
<template><div class="feedback-root"><header class="feedback-header"><h1 class="feedback-title">{{ t('feedback.submittedTitle') }}</h1></header><main class="feedback-success"><div class="feedback-success-art">🎉</div><h2>{{ t('feedback.submittedTitle') }}</h2><p>{{ t('feedback.submittedDesc') }}</p><button class="feedback-submit" type="button" @click="goToActivityCenter(router, String(route.query.activity_id || ''))">{{ t('feedback.back') }}</button></main></div></template>
