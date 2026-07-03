<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  getActivityLocale,
  SUPPORTED_UI_LOCALES,
  switchUserActivityLocale,
  t,
} from "../lib/i18n/activity-locale.js";

const rootRef = ref(null);
const open = ref(false);
const currentLocale = computed(() => getActivityLocale());

function closeMenu() {
  open.value = false;
}

function toggleMenu(event) {
  event.stopPropagation();
  open.value = !open.value;
}

function selectLocale(code) {
  closeMenu();
  if (code === currentLocale.value) return;
  switchUserActivityLocale(code);
}

function labelFor(option) {
  return t(option.ariaLabelKey);
}

function onDocumentClick(event) {
  if (!open.value) return;
  const root = rootRef.value;
  if (root && event.target instanceof Node && root.contains(event.target)) return;
  closeMenu();
}

function onDocumentKeydown(event) {
  if (event.key === "Escape") closeMenu();
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onDocumentKeydown);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("keydown", onDocumentKeydown);
});
</script>

<template>
  <div ref="rootRef" class="activity-language-switcher" dir="ltr">
    <button
      type="button"
      class="activity-language-switcher__trigger"
      :aria-label="t('common.switchLanguage')"
      :aria-expanded="open ? 'true' : 'false'"
      aria-haspopup="listbox"
      @click="toggleMenu"
    >
      <svg
        class="activity-language-switcher__icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6" />
        <path
          d="M3 12h18M12 3c2.8 2.2 4.5 5.4 4.5 9s-1.7 6.8-4.5 9M12 3c-2.8 2.2-4.5 5.4-4.5 9s1.7 6.8 4.5 9"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </svg>
    </button>

    <div
      v-show="open"
      class="activity-language-switcher__menu"
      role="listbox"
      :aria-label="t('common.switchLanguage')"
    >
      <button
        v-for="option in SUPPORTED_UI_LOCALES"
        :key="option.code"
        type="button"
        class="activity-language-switcher__option"
        :class="{ 'activity-language-switcher__option--active': currentLocale === option.code }"
        role="option"
        :aria-selected="currentLocale === option.code ? 'true' : 'false'"
        :aria-label="labelFor(option)"
        @click.stop="selectLocale(option.code)"
      >
        <span class="activity-language-switcher__label" :dir="option.code === 'ur' ? 'rtl' : 'ltr'">
          {{ option.nativeLabel }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.activity-language-switcher {
  position: relative;
  display: inline-flex;
  direction: ltr;
}

.activity-language-switcher__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid rgba(236, 91, 19, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #ec5b13;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
}

.activity-language-switcher__trigger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(236, 91, 19, 0.18);
}

.activity-language-switcher__trigger:active {
  transform: scale(0.96);
}

.activity-language-switcher__icon {
  width: 14px;
  height: 14px;
  display: block;
}

.activity-language-switcher__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  left: auto;
  min-width: 132px;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid rgba(236, 91, 19, 0.12);
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  z-index: 1300;
}

.activity-language-switcher__option {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #374151;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  text-align: left;
  cursor: pointer;
}

.activity-language-switcher__label {
  display: block;
}

.activity-language-switcher__option:hover {
  background: rgba(236, 91, 19, 0.08);
}

.activity-language-switcher__option--active {
  background: rgba(236, 91, 19, 0.12);
  color: #ec5b13;
}
</style>
