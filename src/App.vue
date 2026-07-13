<script setup>
import { RouterView } from 'vue-router'
import ActivityAlertModal from './components/ActivityAlertModal.vue'
</script>

<template>
  <div class="app-shell">
    <RouterView />
    <ActivityAlertModal />
  </div>
</template>

<style>
.app-shell {
  position: relative;
  min-height: 100vh;
}
</style>
