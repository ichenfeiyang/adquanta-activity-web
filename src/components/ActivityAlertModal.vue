<script setup>
import "../assets/activity-alert.css";
</script>

<template>
  <div id="activityAlertModal" class="activity-alert-overlay">
    <div class="activity-alert-card">
      <button id="activityAlertCloseBtn" type="button" class="activity-alert-close" aria-label="Close">✕</button>
      <div id="activityAlertTitle" class="activity-alert-title">Notice</div>
      <div id="activityAlertMessage" class="activity-alert-message" />
    </div>
  </div>
</template>
