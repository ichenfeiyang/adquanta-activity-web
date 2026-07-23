<script setup>
/**
 * NoviceGuideComplete – 完成弹窗
 */
import { useI18n } from '../composables/useI18n.js';
import { assetUrl } from '../lib/asset-url.js';

const { t } = useI18n();

defineProps({ visible: { type: Boolean, default: false } });
defineEmits(['done']);
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="ng-complete-overlay">
      <div class="ng-complete-card">
        <div class="ng-complete-icon" aria-hidden="true">
          <img :src="assetUrl('icons/start_final_gift.svg')" alt="" width="400" height="100">
        </div>
        <h2 class="ng-complete-title">{{ t('novice.complete.title') }}</h2>
        <p class="ng-complete-desc">{{ t('novice.complete.desc') }}</p>
        <button class="ng-complete-ok" @click="$emit('done')">
          {{ t('novice.complete.ok') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>
