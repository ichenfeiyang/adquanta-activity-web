<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { assetUrl } from "../lib/asset-url.js";
import { ACTIVITY_RULE_SECTIONS, getVisibleActivityRuleFaqs } from "../lib/activity-rules.js";
import { useI18n } from "../composables/useI18n.js";

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  hideAvailable: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close", "hide"]);
const { t } = useI18n();
const dialogRef = ref(null);
const closeButtonRef = ref(null);
const visibleFaqs = computed(() => getVisibleActivityRuleFaqs(props.hideAvailable));

let previousBodyOverflow = "";
let bodyLocked = false;
let returnFocusElement = null;

function close() {
  emit("close");
}

function onDocumentKeydown(event) {
  if (event.key === "Escape" && props.visible) {
    event.preventDefault();
    close();
  }
}

function lockBodyScroll() {
  if (bodyLocked || typeof document === "undefined") return;
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  bodyLocked = true;
}

function unlockBodyScroll() {
  if (!bodyLocked || typeof document === "undefined") return;
  document.body.style.overflow = previousBodyOverflow;
  bodyLocked = false;
}

function restoreFocus() {
  const target = returnFocusElement;
  returnFocusElement = null;
  if (target && typeof target.focus === "function" && target.isConnected !== false) {
    nextTick(() => target.focus({ preventScroll: true }));
  }
}

function scrollToSection(sectionId) {
  const section = dialogRef.value?.querySelector(`#rules-section-${sectionId}`);
  section?.scrollIntoView({ behavior: "smooth", block: "start" });
}

watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      if (typeof document !== "undefined") {
        returnFocusElement = document.activeElement;
        document.addEventListener("keydown", onDocumentKeydown);
      }
      lockBodyScroll();
      await nextTick();
      closeButtonRef.value?.focus({ preventScroll: true });
      return;
    }

    if (typeof document !== "undefined") {
      document.removeEventListener("keydown", onDocumentKeydown);
    }
    unlockBodyScroll();
    restoreFocus();
  },
);

onBeforeUnmount(() => {
  if (typeof document !== "undefined") {
    document.removeEventListener("keydown", onDocumentKeydown);
  }
  unlockBodyScroll();
});
</script>

<template>
  <Teleport to="body">
    <Transition name="tc-rules-fade">
      <div v-if="visible" class="tc-rules-overlay" @click.self="close">
        <section
          ref="dialogRef"
          class="tc-rules-dialog"
          role="dialog"
          aria-modal="true"
          :aria-label="t('rules.ariaLabel')"
        >
          <button
            ref="closeButtonRef"
            type="button"
            class="tc-rules-close"
            :aria-label="t('common.close')"
            @click="close"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
            </svg>
          </button>

          <div class="tc-rules-scroll">
            <div class="tc-rules-hero">
              <div class="tc-rules-hero-orb tc-rules-hero-orb--one" aria-hidden="true" />
              <div class="tc-rules-hero-orb tc-rules-hero-orb--two" aria-hidden="true" />
              <div class="tc-rules-hero-icon" aria-hidden="true">
                <svg viewBox="0 0 48 48" fill="none">
                  <path d="M14 7.5h15l7 7v25H14a3 3 0 0 1-3-3v-26a3 3 0 0 1 3-3Z" fill="rgba(255,255,255,.18)" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" />
                  <path d="M29 7.5v7h7M18 23h12M18 29h12M18 35h8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
                  <circle cx="12" cy="14" r="4" fill="#ffd166" />
                  <path d="m10.5 14 1 1 2-2.2" stroke="#c2410c" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </div>
              <div class="tc-rules-hero-copy">
                <span class="tc-rules-eyebrow">{{ t('rules.eyebrow') }}</span>
                <h2>{{ t('rules.title') }}</h2>
                <p>{{ t('rules.subtitle') }}</p>
              </div>
            </div>

            <nav class="tc-rules-nav" :aria-label="t('rules.quickNav')">
              <span class="tc-rules-nav-label">{{ t('rules.quickNav') }}</span>
              <div class="tc-rules-nav-list">
                <button
                  v-for="section in ACTIVITY_RULE_SECTIONS"
                  :key="section.id"
                  type="button"
                  @click="scrollToSection(section.id)"
                >
                  {{ t(section.titleKey) }}
                </button>
                <button type="button" @click="scrollToSection('faq')">
                  {{ t('rules.faq.title') }}
                </button>
              </div>
            </nav>

            <div class="tc-rules-content">
              <article
                v-for="(section, sectionIndex) in ACTIVITY_RULE_SECTIONS"
                :id="`rules-section-${section.id}`"
                :key="section.id"
                class="tc-rules-section"
                :class="{ 'tc-rules-section--accent': section.accent }"
              >
                <div class="tc-rules-section-head">
                  <div class="tc-rules-section-icon" :class="{ 'is-accent': section.accent }" aria-hidden="true">
                    <img :src="assetUrl(section.icon)" alt="" width="28" height="28">
                  </div>
                  <div>
                    <span class="tc-rules-section-index">
                      {{ t('rules.sectionLabel', { number: sectionIndex + 1 }) }}
                    </span>
                    <h3>{{ t(section.titleKey) }}</h3>
                  </div>
                </div>

                <div class="tc-rules-section-body">
                  <p v-for="paragraphKey in section.paragraphKeys" :key="paragraphKey">
                    {{ t(paragraphKey) }}
                  </p>

                  <ol v-if="section.stepKeys?.length" class="tc-rules-steps">
                    <li v-for="(stepKey, stepIndex) in section.stepKeys" :key="stepKey">
                      <span aria-hidden="true">{{ stepIndex + 1 }}</span>
                      <div>
                        <strong>{{ t('rules.stepLabel', { number: stepIndex + 1 }) }}</strong>
                        <p>{{ t(stepKey) }}</p>
                      </div>
                    </li>
                  </ol>

                  <aside v-if="section.noteKey" class="tc-rules-note">
                    <span class="tc-rules-note-icon" aria-hidden="true">!</span>
                    <div>
                      <strong>{{ t('rules.noteLabel') }}</strong>
                      <p>{{ t(section.noteKey) }}</p>
                    </div>
                  </aside>
                </div>
              </article>

              <section id="rules-section-faq" class="tc-rules-faq">
                <div class="tc-rules-faq-head">
                  <span class="tc-rules-faq-icon" aria-hidden="true">?</span>
                  <div>
                    <h3>{{ t('rules.faq.title') }}</h3>
                    <p>{{ t('rules.faq.subtitle') }}</p>
                  </div>
                </div>

                <div class="tc-rules-faq-list">
                  <details
                    v-for="(faq, faqIndex) in visibleFaqs"
                    :key="faq.id"
                    :open="faqIndex === 0"
                    :class="{ 'has-action': faq.actionKey && hideAvailable }"
                  >
                    <summary>
                      <span class="tc-rules-faq-question">
                        {{ t(faq.questionKey) }}
                    <button
                      v-if="faq.actionKey && hideAvailable"
                      id="rules_faq_hide_entry"
                      type="button"
                      class="tc-rules-faq-action"
                          @click.stop.prevent="emit('hide')"
                        >
                          {{ t(faq.actionKey) }}
                        </button>
                      </span>
                      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="m6 8 4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </summary>
                    <p>{{ t(faq.answerKey) }}</p>
                  </details>
                </div>
              </section>
            </div>

            <div class="tc-rules-footer">
              <button type="button" @click="close">{{ t('rules.done') }}</button>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tc-rules-overlay {
  position: fixed;
  z-index: 2200;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  background: rgba(22, 12, 7, 0.68);
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(7px);
}

.tc-rules-dialog {
  position: relative;
  width: min(100%, 600px);
  max-height: min(92dvh, 860px);
  overflow: hidden;
  border: 1px solid rgba(255, 190, 146, 0.7);
  border-radius: 28px;
  background: #fffaf6;
  box-shadow: 0 28px 80px rgba(24, 12, 4, 0.42);
  outline: none;
}

.tc-rules-scroll {
  max-height: min(92dvh, 860px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #f6a36f transparent;
}

.tc-rules-scroll::-webkit-scrollbar {
  width: 6px;
}

.tc-rules-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: #f6a36f;
}

.tc-rules-close {
  position: absolute;
  z-index: 4;
  inset-block-start: 14px;
  inset-inline-end: 14px;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.48);
  border-radius: 999px;
  background: rgba(96, 38, 10, 0.28);
  color: #fff;
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.tc-rules-close svg {
  width: 21px;
  height: 21px;
}

.tc-rules-close:focus-visible,
.tc-rules-footer button:focus-visible,
.tc-rules-nav button:focus-visible,
.tc-rules-faq summary:focus-visible {
  outline: 3px solid rgba(255, 210, 92, 0.92);
  outline-offset: 2px;
}

.tc-rules-hero {
  position: relative;
  min-height: 210px;
  display: flex;
  align-items: center;
  gap: 20px;
  overflow: hidden;
  padding: 48px 54px 34px 32px;
  color: #fff;
  background:
    radial-gradient(circle at 12% 8%, rgba(255, 220, 119, 0.38), transparent 32%),
    linear-gradient(135deg, #ff7a18 0%, #ec4e0b 56%, #c93405 100%);
}

.tc-rules-hero::after {
  content: "";
  position: absolute;
  inset: auto -20% -52% 18%;
  height: 180px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  transform: rotate(-7deg);
}

.tc-rules-hero-orb {
  position: absolute;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
}

.tc-rules-hero-orb--one {
  width: 96px;
  height: 96px;
  inset-block-start: -42px;
  inset-inline-start: 38%;
}

.tc-rules-hero-orb--two {
  width: 54px;
  height: 54px;
  inset-block-end: 14px;
  inset-inline-end: 18px;
}

.tc-rules-hero-icon {
  position: relative;
  z-index: 1;
  width: 92px;
  height: 92px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.14);
  box-shadow: 0 16px 42px rgba(105, 28, 0, 0.24);
  transform: rotate(-4deg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.tc-rules-hero-icon svg {
  width: 58px;
  height: 58px;
}

.tc-rules-hero-copy {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.tc-rules-eyebrow {
  display: inline-flex;
  margin-bottom: 8px;
  padding: 5px 10px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 999px;
  background: rgba(115, 32, 0, 0.18);
  color: #fff1d4;
  font-size: 11px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.tc-rules-hero h2 {
  margin: 0;
  font-size: clamp(26px, 7vw, 38px);
  line-height: 1.08;
  font-weight: 900;
  letter-spacing: -0.03em;
  text-shadow: 0 4px 16px rgba(104, 24, 0, 0.22);
}

.tc-rules-hero p {
  max-width: 390px;
  margin: 10px 0 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  line-height: 1.55;
}

.tc-rules-nav {
  position: sticky;
  z-index: 3;
  top: 0;
  padding: 14px 18px 12px;
  border-bottom: 1px solid rgba(235, 124, 59, 0.14);
  background: rgba(255, 250, 246, 0.94);
  box-shadow: 0 8px 24px rgba(101, 52, 20, 0.06);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.tc-rules-nav-label {
  display: block;
  margin-bottom: 8px;
  color: #8d4b28;
  font-size: 10px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.tc-rules-nav-list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.tc-rules-nav-list::-webkit-scrollbar {
  display: none;
}

.tc-rules-nav button {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 7px 12px;
  border: 1px solid #f7c6a6;
  border-radius: 999px;
  background: #fff;
  color: #b83d0c;
  font: inherit;
  font-size: 11px;
  line-height: 1.2;
  font-weight: 750;
  cursor: pointer;
  box-shadow: 0 3px 9px rgba(174, 66, 13, 0.06);
}

.tc-rules-content {
  display: grid;
  gap: 14px;
  padding: 18px;
  background:
    linear-gradient(rgba(255, 250, 246, 0.92), rgba(255, 250, 246, 0.92)),
    radial-gradient(circle at 20% 20%, #ffd7bc 0 1px, transparent 1.5px);
  background-size: auto, 20px 20px;
}

.tc-rules-section,
.tc-rules-faq {
  scroll-margin-top: 92px;
  overflow: hidden;
  border: 1px solid rgba(235, 124, 59, 0.16);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 12px 32px rgba(116, 54, 14, 0.07);
}

.tc-rules-section--accent {
  border-color: rgba(245, 145, 64, 0.32);
  background: linear-gradient(145deg, #fff 0%, #fff7ed 100%);
}

.tc-rules-section-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 12px;
}

.tc-rules-section-icon {
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid #f8d2ba;
  border-radius: 16px;
  background: linear-gradient(145deg, #fff8f1, #ffebdd);
  box-shadow: 0 7px 16px rgba(231, 92, 23, 0.09);
}

.tc-rules-section-icon.is-accent {
  border-color: #f49352;
  background: linear-gradient(145deg, #ff8b34, #ea4f0c);
}

.tc-rules-section-icon img {
  width: 27px;
  height: 27px;
  object-fit: contain;
}

.tc-rules-section-index {
  display: block;
  margin-bottom: 3px;
  color: #d55a1c;
  font-size: 9px;
  line-height: 1;
  font-weight: 850;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.tc-rules-section h3,
.tc-rules-faq h3 {
  margin: 0;
  color: #25140c;
  font-size: 17px;
  line-height: 1.25;
  font-weight: 850;
  letter-spacing: -0.01em;
}

.tc-rules-section-body {
  padding: 0 16px 17px;
}

.tc-rules-section-body > p,
.tc-rules-note p,
.tc-rules-steps p,
.tc-rules-faq-head p,
.tc-rules-faq details > p {
  margin: 0;
  color: #5b463a;
  font-size: 13px;
  line-height: 1.68;
}

.tc-rules-section-body > p + p {
  margin-top: 9px;
}

.tc-rules-steps {
  display: grid;
  gap: 9px;
  margin: 13px 0 0;
  padding: 0;
  list-style: none;
}

.tc-rules-steps li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px;
  border: 1px solid #f7dfcf;
  border-radius: 14px;
  background: #fffaf6;
}

.tc-rules-steps li > span {
  width: 25px;
  height: 25px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: linear-gradient(145deg, #ff7f26, #ea4d09);
  color: #fff;
  font-size: 12px;
  line-height: 1;
  font-weight: 850;
  box-shadow: 0 5px 12px rgba(230, 76, 8, 0.2);
}

.tc-rules-steps strong,
.tc-rules-note strong {
  display: block;
  margin-bottom: 3px;
  color: #8f3510;
  font-size: 10px;
  line-height: 1.2;
  font-weight: 850;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tc-rules-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 13px;
  padding: 12px;
  border: 1px solid #f4ca83;
  border-radius: 14px;
  background: linear-gradient(145deg, #fffaf0, #fff2d8);
}

.tc-rules-note-icon {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #f59e0b;
  color: #fff;
  font-size: 13px;
  font-weight: 900;
}

.tc-rules-faq-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 17px 16px 13px;
  color: #fff;
  background: linear-gradient(135deg, #6f3219, #a44218);
}

.tc-rules-faq-head h3 {
  color: #fff;
}

.tc-rules-faq-head p {
  margin-top: 3px;
  color: rgba(255, 255, 255, 0.76);
  font-size: 11.5px;
}

.tc-rules-faq-icon {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.26);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.12);
  color: #ffd37a;
  font-size: 23px;
  font-weight: 900;
}

.tc-rules-faq-list {
  padding: 4px 14px 12px;
}

.tc-rules-faq details {
  border-bottom: 1px solid #f4e0d4;
}

.tc-rules-faq details:last-child {
  border-bottom: 0;
}

.tc-rules-faq summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  padding: 11px 2px;
  color: #3b2114;
  font-size: 12.5px;
  line-height: 1.45;
  font-weight: 750;
  list-style: none;
  cursor: pointer;
}

.tc-rules-faq summary::-webkit-details-marker {
  display: none;
}

.tc-rules-faq summary svg {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  color: #d3561b;
  transition: transform 180ms ease;
}

.tc-rules-faq details[open] summary svg {
  transform: rotate(180deg);
}

.tc-rules-faq details > p {
  padding: 0 2px 14px;
  color: #6b5144;
}

.tc-rules-faq-action {
  margin-inline-start: 6px;
  padding: 4px 10px;
  border: 1px solid #ef6a2c;
  border-radius: 999px;
  background: #fff7ed;
  color: #d94f12;
  font: inherit;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 800;
  cursor: pointer;
}

.tc-rules-faq-action:focus-visible {
  outline: 2px solid #ef6a2c;
  outline-offset: 2px;
}

.tc-rules-footer {
  position: sticky;
  z-index: 3;
  bottom: 0;
  padding: 12px 18px max(14px, env(safe-area-inset-bottom));
  border-top: 1px solid rgba(235, 124, 59, 0.14);
  background: rgba(255, 250, 246, 0.94);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.tc-rules-footer button {
  width: 100%;
  min-height: 48px;
  border: 0;
  border-radius: 15px;
  background: linear-gradient(135deg, #ff7a18, #e84708);
  color: #fff;
  font: inherit;
  font-size: 14px;
  font-weight: 850;
  cursor: pointer;
  box-shadow: 0 12px 28px rgba(230, 70, 7, 0.27);
}

.tc-rules-fade-enter-active,
.tc-rules-fade-leave-active {
  transition: opacity 180ms ease;
}

.tc-rules-fade-enter-active .tc-rules-dialog,
.tc-rules-fade-leave-active .tc-rules-dialog {
  transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 180ms ease;
}

.tc-rules-fade-enter-from,
.tc-rules-fade-leave-to {
  opacity: 0;
}

.tc-rules-fade-enter-from .tc-rules-dialog,
.tc-rules-fade-leave-to .tc-rules-dialog {
  opacity: 0;
  transform: translateY(18px) scale(0.98);
}

@media (max-width: 520px) {
  .tc-rules-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .tc-rules-dialog,
  .tc-rules-scroll {
    width: 100%;
    max-height: 94dvh;
  }

  .tc-rules-dialog {
    border-radius: 26px 26px 0 0;
    border-bottom: 0;
  }

  .tc-rules-hero {
    min-height: 188px;
    gap: 14px;
    padding: 44px 46px 28px 20px;
  }

  .tc-rules-hero-icon {
    width: 72px;
    height: 72px;
    border-radius: 22px;
  }

  .tc-rules-hero-icon svg {
    width: 47px;
    height: 47px;
  }

  .tc-rules-hero h2 {
    font-size: clamp(24px, 7.5vw, 32px);
  }

  .tc-rules-hero p {
    font-size: 12.5px;
    line-height: 1.5;
  }

  .tc-rules-nav {
    padding-inline: 14px;
  }

  .tc-rules-content {
    padding: 14px;
  }
}

@media (max-width: 360px) {
  .tc-rules-hero {
    align-items: flex-start;
  }

  .tc-rules-hero-icon {
    width: 58px;
    height: 58px;
    border-radius: 18px;
  }

  .tc-rules-hero-icon svg {
    width: 39px;
    height: 39px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tc-rules-fade-enter-active,
  .tc-rules-fade-leave-active,
  .tc-rules-fade-enter-active .tc-rules-dialog,
  .tc-rules-fade-leave-active .tc-rules-dialog,
  .tc-rules-faq summary svg {
    transition: none;
  }
}
</style>
