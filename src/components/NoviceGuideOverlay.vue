<script setup>
/**
 * NoviceGuideOverlay – 共用引导覆盖层（Step 1 ~ Step 4）
 *
 * Props:
 *  - active          是否显示
 *  - selector        高亮目标元素 CSS 选择器
 *  - actionSelector  按钮选择器（用于定位手指动画）
 *  - mainText        主文案
 *  - subText         补充文案（可选）
 *  - extraText       额外提示文案（可选）
 *  - textPosition    文案位置 'above' | 'below'（默认 'above'）
 */
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  active:           { type: Boolean, default: false },
  selector:         { type: String, required: true },
  actionSelector:   { type: String, default: '' },
  mainText:         { type: String, default: '' },
  subText:          { type: String, default: '' },
  extraText:        { type: String, default: '' },
  textPosition:     { type: String, default: 'above' },
});

const emit = defineEmits(['exit']);

const highlightRect = ref({ top: 0, left: 0, width: 0, height: 0 });
const fingerPos     = ref({ x: 0, y: 0 });
const textBoxTop    = ref(0);

function recalc() {
  const el = document.querySelector(props.selector);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const scrollY = window.scrollY || 0;
  const docTop = rect.top + scrollY;

  // 高亮框 & 手指：overlay 容器是 position:fixed，子级 absolute 的 top 是视口坐标
  // 因此直接用 rect.top / rect.left（视口坐标）
  highlightRect.value = {
    top:    rect.top,
    left:   rect.left,
    width:  rect.width,
    height: rect.height,
  };

  if (props.actionSelector) {
    const btn = document.querySelector(props.actionSelector);
    if (btn) {
      const btnRect = btn.getBoundingClientRect();
      fingerPos.value = {
        x: btnRect.left + btnRect.width / 2,
        y: btnRect.top - 22,
      };
    }
  }

  // 文案区单独 Teleport，用文档坐标定位（position:absolute 无 fixed 父级干扰）
  const textBoxHeight = 80;
  const gap = 10;
  if (props.textPosition === 'below') {
    textBoxTop.value = docTop + rect.height + gap;
  } else {
    textBoxTop.value = docTop - textBoxHeight - gap;
  }
}

function onExit(e) {
  e.stopPropagation();
  emit('exit');
}

// ── 滚动 & resize 监听 ──
let scrollRAF = 0;
function onScroll() {
  if (scrollRAF) return;
  scrollRAF = requestAnimationFrame(() => {
    scrollRAF = 0;
    recalc();
  });
}

function onResize() {
  recalc();
}

function addListeners() {
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
}

function removeListeners() {
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onResize);
  if (scrollRAF) cancelAnimationFrame(scrollRAF);
  scrollRAF = 0;
}

watch(() => props.active, (v) => {
  if (v) {
    nextTick(recalc);
    addListeners();
  } else {
    removeListeners();
  }
});

onMounted(() => {
  if (props.active) {
    nextTick(recalc);
    addListeners();
  }
});

onBeforeUnmount(() => {
  removeListeners();
});
</script>

<template>
  <!-- overlay 容器：position:fixed（视口坐标系），pointer-events:none 不阻断滚动 -->
  <Teleport to="body">
    <div v-if="active" class="ng-overlay">
      <div class="ng-mask" />
      <div
        class="ng-highlight"
        :style="{
          top:    highlightRect.top    + 'px',
          left:   highlightRect.left   + 'px',
          width:  highlightRect.width  + 'px',
          height: highlightRect.height + 'px',
        }"
      />
      <div
        v-if="actionSelector"
        class="ng-finger"
        :style="{ left: fingerPos.x + 'px', top: fingerPos.y + 'px' }"
      >
        <div class="ng-finger-icon">👆</div>
      </div>
    </div>
  </Teleport>

  <!-- 文案区：单独 Teleport，position:absolute 用文档坐标定位，pointer-events:auto 保留点击退出 -->
  <Teleport to="body">
    <div
      v-if="active"
      class="ng-text-box"
      :style="{ top: textBoxTop + 'px' }"
      @click="onExit"
    >
      <p class="ng-text-main">{{ mainText }}</p>
      <p v-if="subText"  class="ng-text-sub">{{ subText }}</p>
      <p v-if="extraText" class="ng-text-extra">{{ extraText }}</p>
    </div>
  </Teleport>
</template>
