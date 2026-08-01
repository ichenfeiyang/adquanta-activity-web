<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  getActivityLocale,
  isRtlActivityLocale,
  SUPPORTED_UI_LOCALES,
  switchUserActivityLocale,
  t,
} from "../lib/i18n/activity-locale.js";

const open = ref(false);
const rootEl = ref(null);
const currentLocale = computed(() => getActivityLocale());

const currentOption = computed(
  () => SUPPORTED_UI_LOCALES.find((item) => item.code === currentLocale.value) || SUPPORTED_UI_LOCALES[0],
);

const isRtl = computed(() => isRtlActivityLocale(currentLocale.value));

function toggleMenu() {
  open.value = !open.value;
}

function closeMenu() {
  open.value = false;
}

function selectLocale(code) {
  closeMenu();
  if (!code || code === currentLocale.value) return;
  switchUserActivityLocale(code);
}

function onDocumentPointerDown(event) {
  if (!open.value) return;
  const root = rootEl.value;
  if (root && !root.contains(event.target)) {
    closeMenu();
  }
}

function onDocumentKeyDown(event) {
  if (event.key === "Escape") {
    closeMenu();
  }
}

onMounted(() => {
  document.addEventListener("pointerdown", onDocumentPointerDown);
  document.addEventListener("keydown", onDocumentKeyDown);
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", onDocumentPointerDown);
  document.removeEventListener("keydown", onDocumentKeyDown);
});
</script>

<template>
  <div
    ref="rootEl"
    class="activity-language-switcher"
  >
    <button
      type="button"
      class="activity-language-switcher__trigger"
      :class="{ 'activity-language-switcher__trigger--rtl': isRtl }"
      :dir="isRtl ? 'rtl' : 'ltr'"
      :aria-label="t('common.switchLanguage')"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggleMenu"
    >
      <span class="activity-language-switcher__trigger-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
          <path d="M3.5 12h17" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M12 3c2.2 2.3 3.3 5.3 3.3 9S14.2 18.7 12 21c-2.2-2.3-3.3-5.3-3.3-9S9.8 5.3 12 3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
        </svg>
      </span>
      <span class="activity-language-switcher__trigger-code">{{ currentOption.shortLabel }}</span>
      <span class="activity-language-switcher__trigger-chevron" aria-hidden="true">
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </button>

    <Transition name="activity-language-menu">
      <div
        v-if="open"
        class="activity-language-switcher__menu"
        :class="{ 'activity-language-switcher__menu--rtl': isRtl }"
        :dir="isRtl ? 'rtl' : 'ltr'"
        role="listbox"
        :aria-label="t('common.switchLanguage')"
      >
        <button
          v-for="option in SUPPORTED_UI_LOCALES"
          :key="option.code"
          type="button"
          class="activity-language-switcher__option"
          :class="{ 'activity-language-switcher__option--active': option.code === currentLocale }"
          role="option"
          :aria-selected="option.code === currentLocale"
          @click="selectLocale(option.code)"
        >
          <span class="activity-language-switcher__option-flag" aria-hidden="true">{{ option.flag }}</span>
          <span class="activity-language-switcher__option-code">{{ option.shortLabel }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.activity-language-switcher {
  position: relative;
  z-index: 40;
  display: inline-flex;
}

.activity-language-switcher__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 76px;
  height: 36px;
  padding-inline: 11px 10px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 999px;
  background: #ffffff;
  color: #050914;
  box-shadow:
    0 8px 22px rgba(15, 23, 42, 0.06),
    inset 0 0 0 1px rgba(15, 23, 42, 0.03);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.activity-language-switcher__trigger--rtl {
  direction: rtl;
}

.activity-language-switcher__trigger-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.activity-language-switcher__trigger-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}

.activity-language-switcher__trigger-code {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1;
}

.activity-language-switcher__trigger-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #050914;
  margin-inline-start: -2px;
}

.activity-language-switcher__trigger:active {
  transform: scale(0.96);
}

.activity-language-switcher__trigger:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 3px rgba(236, 91, 19, 0.18),
    0 6px 16px rgba(236, 91, 19, 0.2);
}

.activity-language-switcher__menu {
  position: absolute;
  z-index: 41;
  right: 0;
  top: calc(100% + 10px);
  min-width: 112px;
  max-width: calc(100vw - 24px);
  padding: 6px;
  box-sizing: border-box;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: #ffffff;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.14);
}

.activity-language-switcher__menu--rtl {
  right: auto;
  left: 0;
  direction: rtl;
}

.activity-language-switcher__option {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 40px;
  padding: 0 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #374151;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  text-align: start;
}

.activity-language-switcher__menu--rtl .activity-language-switcher__option {
  justify-content: flex-start;
}

.activity-language-switcher__option:hover {
  background: rgba(236, 91, 19, 0.08);
}

.activity-language-switcher__option--active {
  background: rgba(236, 91, 19, 0.12);
  color: #ec5b13;
}

.activity-language-switcher__option-flag {
  font-size: 18px;
  line-height: 1;
}

.activity-language-switcher__option-code {
  min-width: 24px;
}

.activity-language-menu-enter-active,
.activity-language-menu-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.activity-language-menu-enter-from,
.activity-language-menu-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
