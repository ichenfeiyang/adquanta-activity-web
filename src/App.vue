<script setup>
import { RouterView } from 'vue-router'
import ActivityAlertModal from './components/ActivityAlertModal.vue'
import ActivityLanguageSwitcher from './components/ActivityLanguageSwitcher.vue'
</script>

<template>
  <div class="app-shell">
    <div class="app-language-bar" aria-hidden="false">
      <ActivityLanguageSwitcher />
    </div>
    <RouterView />
    <ActivityAlertModal />
  </div>
</template>

<style>
.app-shell {
  position: relative;
  min-height: 100vh;
}

.app-language-bar {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 6px);
  right: max(8px, calc((100vw - 480px) / 2 + 8px));
  z-index: 1200;
  pointer-events: none;
}

.app-language-bar > * {
  pointer-events: auto;
}
</style>
