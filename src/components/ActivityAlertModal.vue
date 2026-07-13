<script setup>
import "../assets/activity-alert.css";
import { useI18n } from "../composables/useI18n.js";

const { t } = useI18n();
</script>

<template>
  <div id="activityAlertModal" class="activity-alert-overlay">
    <div class="activity-alert-card">
      <button id="activityAlertCloseBtn" type="button" class="activity-alert-close" :aria-label="t('common.close')">✕</button>
      <div id="activityAlertTitle" class="activity-alert-title">{{ t('alert.notice') }}</div>
      <div id="activityAlertMessage" class="activity-alert-message" />
    </div>
  </div>
</template>
