<script setup>
/**
 * NoviceGuideWelcome – 欢迎弹窗（新手引导第一步）
 */
import { useI18n } from '../composables/useI18n.js';

const { t } = useI18n();

defineProps({ visible: { type: Boolean, default: false } });
defineEmits(['skip', 'start']);
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="ng-welcome-overlay" @click.self="$emit('skip')">
      <div class="ng-welcome-card">
        <div class="ng-welcome-icon" aria-hidden="true">🎁</div>
        <h2 class="ng-welcome-title">{{ t('novice.welcome.title') }}</h2>
        <p class="ng-welcome-desc">{{ t('novice.welcome.desc') }}</p>
        <div class="ng-welcome-actions">
          <button class="ng-btn-skip" @click="$emit('skip')">
            {{ t('novice.welcome.skip') }}
          </button>
          <button class="ng-btn-start" @click="$emit('start')">
            {{ t('novice.welcome.start') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
