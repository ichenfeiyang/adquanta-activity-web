<script setup>
/**
 * NoviceGuideOverlay – 共用引导覆盖层（Step 1 ~ Step 4）
 *
 * Props:
 *  - active          是否显示
 *  - selector        高亮目标元素 CSS 选择器
 *  - actionSelector  按钮选择器（用于定位手指动画）
 *  - mainText        主文案（单气泡模式）
 *  - subText         补充文案（单气泡模式）
 *  - extraText       额外提示文案（单气泡模式）
 *  - textPosition    文案位置 'above' | 'below'（默认 'above'，单气泡模式）
 *  - bubbles         多气泡模式：[{ mainText, subText, highlightSelector?, offset? }]
 *  - bubblesContainerSelector  双气泡容器锚定的元素选择器
 */
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  active:           { type: Boolean, default: false },
  selector:         { type: String, required: true },
  actionSelector:   { type: String, default: '' },
  mainText:         { type: String, default: '' },
  subText:          { type: String, default: '' },
  extraText:        { type: String, default: '' },
  textPosition:     { type: String, default: 'above' },
  bubbles:          { type: Array, default: null },
  bubblesContainerSelector: { type: String, default: '' },
});

const emit = defineEmits(['exit']);

const highlightRect = ref({ top: 0, left: 0, width: 0, height: 0 });
const fingerPos     = ref({ x: 0, y: 0 });
const textBoxTop    = ref(0);
const containerStyle = ref({});
const bubbleLeftStyle = ref({});
const bubbleRightStyle = ref({});
const arrowSvgLeft = ref(0);
const arrowSvgPath = ref('');
const arrowEndpoint = ref({ x: 0, y: 0 });

// 箭头三角：基于 Q 曲线终点切线方向计算
const arrowHeadPoints = computed(() => {
  const p = arrowSvgPath.value;
  if (!p) return '';
  // 解析 Q cmd 的控制点和终点
  const parts = p.split(/[\s,]+/);
  // M x1 y1 Q cx cy ex ey
  const cx = parseFloat(parts[3]);
  const cy = parseFloat(parts[4]);
  const ex = parseFloat(parts[5]);
  const ey = parseFloat(parts[6]);
  if ([cx, cy, ex, ey].some(Number.isNaN)) return '';
  // 切线方向 (cx→ex, cy→ey)
  const dx = ex - cx;
  const dy = ey - cy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // 三角形参数
  const size = 7;
  const spread = 4;
  // 顶点 = 终点
  // 两个底角 = 沿反方向偏移
  const bx1 = ex - ux * size - uy * spread;
  const by1 = ey - uy * size + ux * spread;
  const bx2 = ex - ux * size + uy * spread;
  const by2 = ey - uy * size - ux * spread;
  return `${ex},${ey} ${bx1},${by1} ${bx2},${by2}`;
});

function recalc() {
  const el = document.querySelector(props.selector);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const scrollY = window.scrollY || 0;
  const docTop = rect.top + scrollY;

  // 高亮框 & 手指：overlay 容器是 position:fixed，子级 absolute 的 top 是视口坐标
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
        x: btnRect.left + btnRect.width * 0.78,
        y: btnRect.top + btnRect.height * 0.3 + 10,
      };
    }
  }

  // 单气泡模式：文案区单独 Teleport，用文档坐标定位
  const gap = 12;
  const textBox = document.querySelector('.ng-text-box');
  const textBoxHeight = textBox ? textBox.offsetHeight : 80;
  if (props.textPosition === 'below') {
    textBoxTop.value = docTop + rect.height + gap;
  } else {
    textBoxTop.value = docTop - textBoxHeight - gap;
  }

  // ── 双气泡容器模式 ──
  if (props.bubbles && props.bubbles.length && props.bubblesContainerSelector) {
    const anchorEl = document.querySelector(props.bubblesContainerSelector);
    if (!anchorEl) return;
    const anchorRect = anchorEl.getBoundingClientRect();
    const anchorDocTop = anchorRect.top + scrollY;
    const anchorDocLeft = anchorRect.left + scrollY * 0; // 不需要，left 用视口
    const containerGap = 12;
    const cardWidth = Math.min((anchorRect.width - 16) / 2, 170); // 每张卡片最大 170px
    const containerWidth = cardWidth * 2 + 12; // 两张卡片 + 间距

    // 容器：绝对定位，用文档坐标
    containerStyle.value = {
      position: 'absolute',
      top: (anchorDocTop + anchorRect.height + containerGap) + 'px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: containerWidth + 'px',
      display: 'flex',
      gap: '12px',
      zIndex: 10003,
    };

    // 左气泡
    bubbleLeftStyle.value = {
      flex: '1',
      minWidth: 0,
    };

    // 右气泡
    bubbleRightStyle.value = {
      flex: '1',
      minWidth: 0,
    };

    // 计算 ⓘ 图标位置 → 左气泡 CSS 尖角
    const infoIcon = document.querySelector('.tc-checkin-info-icon');
    if (infoIcon) {
      const iconRect = infoIcon.getBoundingClientRect();
      const iconCenterX = iconRect.left + iconRect.width / 2;
      const containerDocLeft = (window.innerWidth - containerWidth) / 2;
      // 尖角 X = ⓘ 中心相对于左气泡左边缘的位置
      arrowSvgLeft.value = Math.max(0, Math.min(
        iconCenterX - containerDocLeft,
        cardWidth,
      ));
    }

    // 计算 Day 7 节点位置 → SVG 曲线虚线箭头
    const day7Node = document.querySelector('#tc-checkin-days-container [data-day="7"]');
    if (day7Node) {
      const day7Rect = day7Node.getBoundingClientRect();
      const day7DocTop = day7Rect.top + scrollY;
      const day7DocLeft = day7Rect.left + day7Rect.width / 2;

      const containerDocLeftVal = (window.innerWidth - containerWidth) / 2;
      const rightBubbleTop = anchorDocTop + anchorRect.height + containerGap;

      // SVG 起点：右气泡右上角
      const startX = containerWidth - 4;
      const startY = 4;
      // SVG 终点：Day 7 节点中心（相对于容器）
      const endX = day7DocLeft - containerDocLeftVal;
      const endY = day7DocTop - rightBubbleTop;

      // 控制点：向右弯曲的弧线
      const midX = Math.max(startX, endX) + 30;
      const midY = (startY + endY) / 2;

      arrowSvgPath.value = `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
      arrowEndpoint.value = { x: endX, y: endY };
    }
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
        <div class="ng-finger-ripple" />
        <div class="ng-finger-icon">👆</div>
      </div>
    </div>
  </Teleport>

  <!-- 双气泡容器模式：独立白色指引气泡，绝对定位用文档坐标 -->
  <Teleport v-if="active && bubbles && bubblesContainerSelector" to="body">
    <div class="ng-bubble-container" :style="containerStyle" @click="onExit">
      <!-- SVG 曲线虚线箭头（容器级别，坐标系与容器一致） -->
      <svg
        v-if="arrowSvgPath"
        class="ng-bubble-svg-arrow"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          :d="arrowSvgPath"
          fill="none"
          stroke="#ec5b13"
          stroke-width="2"
          stroke-dasharray="4 4"
          stroke-linecap="round"
        />
        <!-- 箭头三角 -->
        <polygon
          :points="arrowHeadPoints"
          fill="#ec5b13"
        />
      </svg>

      <!-- 左气泡：Check in every day -->
      <div class="ng-bubble ng-bubble--left" :style="{ ...bubbleLeftStyle, '--arrow-x': arrowSvgLeft + 'px' }">
        <div class="ng-bubble-row">
          <span class="ng-bubble-icon">📅</span>
          <span class="ng-bubble-text">{{ bubbles[0]?.mainText }}</span>
        </div>
        <div class="ng-bubble-row">
          <span class="ng-bubble-icon">🎬</span>
          <span class="ng-bubble-text ng-bubble-text--sub">{{ bubbles[0]?.subText }}</span>
        </div>
      </div>

      <!-- 右气泡：Lucky chests -->
      <div class="ng-bubble ng-bubble--right" :style="bubbleRightStyle">
        <!-- 悬浮宝箱 Icon -->
        <div class="ng-bubble-badge">🎁</div>
        <div class="ng-bubble-content">
          <p class="ng-bubble-main">{{ bubbles[1]?.mainText }}</p>
          <p class="ng-bubble-sub">{{ bubbles[1]?.subText }}</p>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 单气泡模式（兼容旧步骤） -->
  <Teleport v-if="active && !bubbles" to="body">
    <div
      class="ng-text-box ng-text-box--card"
      :style="{ top: textBoxTop + 'px' }"
      @click="onExit"
    >
      <div class="ng-text-box-row">
        <span class="ng-text-box-icon">🎬</span>
        <span class="ng-text-main">{{ mainText }}</span>
      </div>
      <p v-if="subText" class="ng-text-sub">{{ subText }}</p>
      <p v-if="extraText" class="ng-text-extra">{{ extraText }}</p>
      <div class="ng-text-box-arrow" />
    </div>
  </Teleport>
</template>
