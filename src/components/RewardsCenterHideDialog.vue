<script setup>
import { useI18n } from "../composables/useI18n.js";

defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  busy: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["cancel", "confirm"]);
const { t } = useI18n();
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="rewards-hide-overlay" role="presentation">
      <section
        class="rewards-hide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rewards-hide-title"
        aria-describedby="rewards-hide-description"
      >
        <div class="rewards-hide-dialog-icon" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none">
            <path d="M13 22h38v27a6 6 0 0 1-6 6H19a6 6 0 0 1-6-6V22Z" fill="#ff5a1f" />
            <path d="M10 16h44v10H10z" fill="#ff7a32" />
            <path d="M29 16c-7-2-10-7-7-10 3-3 8 1 10 8 2-7 7-11 10-8 3 3 0 8-7 10" stroke="#ffb33c" stroke-width="5" stroke-linecap="round" />
            <path d="M28 16h8v39h-8z" fill="#ffc14b" />
          </svg>
        </div>
        <h2 id="rewards-hide-title">{{ t("feedback.hideDialogTitle") }}</h2>
        <p id="rewards-hide-description">{{ t("feedback.hideDialogDescription") }}</p>
        <p v-if="error" class="rewards-hide-error" role="alert">{{ error }}</p>
        <button id="rewards_center_hide_remove" type="button" class="rewards-hide-remove" :disabled="busy" @click="emit('confirm')">
          {{ busy ? t("feedback.hideRemoving") : t("feedback.hideRemove") }}
        </button>
        <button id="rewards_center_hide_keep" type="button" class="rewards-hide-keep" :disabled="busy" @click="emit('cancel')">
          {{ t("feedback.hideKeep") }}
        </button>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.rewards-hide-overlay {
  position: fixed;
  z-index: 2500;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px;
  background: rgba(13, 14, 18, 0.68);
  box-sizing: border-box;
}

.rewards-hide-dialog {
  width: min(100%, 328px);
  padding: 24px 24px 22px;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
  text-align: center;
}

.rewards-hide-dialog-icon {
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  margin: 0 auto 8px;
  border-radius: 999px;
  background: #fff7ef;
}

.rewards-hide-dialog-icon svg {
  width: 62px;
  height: 62px;
}

.rewards-hide-dialog h2 {
  margin: 4px 0 12px;
  color: #101116;
  font-size: 21px;
  line-height: 1.22;
  font-weight: 800;
  letter-spacing: -0.025em;
}

.rewards-hide-dialog > p {
  margin: 0;
  color: #30323a;
  font-size: 14px;
  line-height: 1.48;
}

.rewards-hide-dialog .rewards-hide-error {
  margin-top: 10px;
  color: #ce3d20;
  font-size: 13px;
}

.rewards-hide-remove,
.rewards-hide-keep {
  width: 100%;
  height: 46px;
  border-radius: 9px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}

.rewards-hide-remove {
  margin-top: 18px;
  border: 1px solid #ff4c25;
  background: #fff;
  color: #f04420;
}

.rewards-hide-keep {
  margin-top: 10px;
  border: 0;
  background: linear-gradient(90deg, #ff3d00 0%, #f4430c 52%, #ff3d00 100%);
  color: #fff;
}

.rewards-hide-remove:disabled,
.rewards-hide-keep:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
