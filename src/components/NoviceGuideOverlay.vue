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
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { assetUrl } from '../lib/asset-url.js';

const props = defineProps({
  active:           { type: Boolean, default: false },
  selector:         { type: String, required: true },
  actionSelector:   { type: String, default: '' },
  mainText:         { type: String, default: '' },
  subText:          { type: String, default: '' },
  extraText:        { type: String, default: '' },
  textPosition:     { type: String, default: 'above' },
  icon:             { type: String, default: '🎬' },
  iconStyle:        { type: String, default: '' },
  stepLabel:        { type: String, default: '' },
  fingerTargets:    { type: Array, default: null },
  bubbles:          { type: Array, default: null },
  bubblesContainerSelector: { type: String, default: '' },
  headerBadge:      { type: String, default: '' },
  arrowX:           { type: Number, default: null },
  highlightGlow:    { type: Boolean, default: false },
  cardGlow:         { type: Boolean, default: false },
});

const emit = defineEmits(['exit']);

const highlightRect = ref({ top: 0, left: 0, width: 0, height: 0 });
const shadowClipPath = ref('polygon(0 0, 100% 0, 100% 100%, 0 100%)');
const fingerPos     = ref({ x: 0, y: 0 });
const textBoxTop    = ref(0);
const textBoxMarginLeft = ref(0);
const containerStyle = ref({});
const bubbleLeftStyle = ref({});
const bubbleRightStyle = ref({});
const arrowSvgLeft = ref(0);
const arrowSvgPath = ref('');
const fingerTargetsPos = ref([]);
const curvePath = ref('');

function computeCurvePath() {
  if (!props.actionSelector || props.textPosition !== 'above') {
    curvePath.value = '';
    return;
  }
  nextTick(() => {
    const textBox = document.querySelector('.ng-text-box');
    const btn = document.querySelector(props.actionSelector);
    if (!textBox || !btn) { curvePath.value = ''; return; }
    const boxRect = textBox.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    // 起点：气泡右侧外壁，标题平齐高度（中上部）
    const startX = boxRect.width;
    const startY = boxRect.height * 0.35;
    // 终点：按钮正上方偏右空地（发光区域内）
    const btnCenterX = btnRect.left + btnRect.width / 2;
    const endX = btnCenterX + btnRect.width * 0.4 - boxRect.left;
    const endY = btnRect.top - boxRect.top;
    // 二次贝塞尔：先向右凸出，再向下弯入
    const midX = Math.max(startX, endX) + 18;
    const midY = startY + (endY - startY) * 0.55;
    curvePath.value = `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
  });
}

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

  // 阴影层 clip-path：顺时针外框 → 逆时针内框挖洞
  const r = highlightRect.value;
  shadowClipPath.value = `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${r.left}px ${r.top}px,${r.left}px ${r.top + r.height}px,${r.left + r.width}px ${r.top + r.height}px,${r.left + r.width}px ${r.top}px,${r.left}px ${r.top}px)`;

  if (props.actionSelector) {
    const btn = document.querySelector(props.actionSelector);
    if (btn) {
      const btnRect = btn.getBoundingClientRect();
      // Step 3：手指位于按钮右下角外侧
        fingerPos.value = {
          x: btnRect.left + btnRect.width * 0.9,
          y: btnRect.top + btnRect.height * 0.5 + 10,
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

  // Step 3：气泡右移至卡片3/5位置（非居中）
  textBoxMarginLeft.value = (props.extraText && props.textPosition === 'above')
    ? rect.width * 0.1
    : 0;

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
      // SVG 终点：Day 7 礼盒图标底部中心
      const chestIcon = day7Node.querySelector('.tc-checkin-chest-icon-img');
      const targetRect = chestIcon ? chestIcon.getBoundingClientRect() : day7Rect;
      const endX = (targetRect.left + targetRect.width / 2 - containerDocLeftVal) + 6;
      const endY = (targetRect.top + targetRect.height - rightBubbleTop) + 10;

      // 控制点：饱满右凸弧度 + 50% 中点入射
      const distanceY = Math.abs(endY - startY);
      const rightOffset = Math.max(65, distanceY * 0.45);
      // 约束曲线 X 不超出卡片右边界，避免手机端溢出裁剪
      const cardRightInSvg = (anchorRect.right - containerDocLeftVal);
      const midXAbsMax = cardRightInSvg - 6; // 留出 stroke-width + 安全间隙
      const midX = Math.min(Math.max(startX, endX) + rightOffset, midXAbsMax);
      const midY = startY + (endY - startY) * 0.5;

      arrowSvgPath.value = `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
    }
  }

  // ── Step 4 手指指向元素 ──
  if (props.fingerTargets && props.fingerTargets.length) {
    const scrollY = window.scrollY || 0;
    fingerTargetsPos.value = props.fingerTargets.map(t => {
      const el = document.querySelector(t.selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 + (t.offsetX || 0),
        y: r.top + (t.offsetY || 0),
      };
    }).filter(Boolean);
  } else {
    fingerTargetsPos.value = [];
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

let shadowClickHandler = null;

function bindShadowCatcher() {
  unbindShadowCatcher();
  nextTick(() => {
    const el = document.querySelector('.ng-shadow-catcher');
    if (el) {
      shadowClickHandler = () => emit('exit');
      el.addEventListener('click', shadowClickHandler);
    }
  });
}

function unbindShadowCatcher() {
  if (shadowClickHandler) {
    const el = document.querySelector('.ng-shadow-catcher');
    if (el) el.removeEventListener('click', shadowClickHandler);
    shadowClickHandler = null;
  }
}

watch(() => props.active, (v) => {
  if (v) {
    nextTick(() => { recalc(); computeCurvePath(); bindShadowCatcher(); });
    addListeners();
  } else {
    removeListeners();
    unbindShadowCatcher();
    curvePath.value = '';
  }
});

onMounted(() => {
  if (props.active) {
    nextTick(() => { recalc(); computeCurvePath(); bindShadowCatcher(); });
    addListeners();
  }
});

onBeforeUnmount(() => {
  removeListeners();
  unbindShadowCatcher();
});
</script>

<template>
  <!-- overlay 容器：position:fixed（视口坐标系），pointer-events:none 不阻断滚动 -->
  <Teleport to="body">
    <div
      v-if="active"
      class="ng-overlay"
    >
      <!-- 可点击阴影层：clip-path 挖出高亮洞，点击阴影退出引导 -->
      <div
        class="ng-shadow-catcher"
        :style="{ clipPath: shadowClipPath }"
      />
      <div
        class="ng-highlight"
        :class="{ 'ng-highlight--glow': highlightGlow }"
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
        <div class="ng-finger-icon ng-finger-icon--tilted">👆</div>
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
        <defs>
          <marker
            id="ng-arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#ec5b13" />
          </marker>
        </defs>
        <path
          :d="arrowSvgPath"
          fill="none"
          stroke="#ec5b13"
          stroke-width="2"
          stroke-dasharray="4 4"
          stroke-linecap="round"
          marker-end="url(#ng-arrowhead)"
        />
      </svg>

      <!-- 左气泡：Check in every day -->
      <div class="ng-bubble ng-bubble--left" :style="{ ...bubbleLeftStyle, '--arrow-x': arrowSvgLeft + 'px' }">
        <div class="ng-bubble-row">
          <span class="ng-bubble-icon"><img :src="assetUrl('icons/icon_calendar.svg')" alt="" width="20" height="20"></span>
          <span class="ng-bubble-text">{{ bubbles[0]?.mainText }}</span>
        </div>
        <div class="ng-bubble-row">
          <span class="ng-bubble-icon"><img :src="assetUrl('icons/icon_video.svg')" alt="" width="20" height="20"></span>
          <span class="ng-bubble-text ng-bubble-text--sub">{{ bubbles[0]?.subText }}</span>
        </div>
      </div>

      <!-- 右气泡：Lucky chests -->
      <div class="ng-bubble ng-bubble--right" :style="bubbleRightStyle">
        <!-- 悬浮宝箱 Icon -->
        <div class="ng-bubble-badge"><img :src="assetUrl('icons/icon_gift.svg')" alt="" width="25" height="25"></div>
        <div class="ng-bubble-content">
          <p class="ng-bubble-main">{{ bubbles[1]?.mainText }}</p>
          <p class="ng-bubble-sub">{{ bubbles[1]?.subText }}</p>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Step 4 手指指向余额区域 -->
  <Teleport v-if="active && fingerTargetsPos.length" to="body">
    <div
      v-for="(pos, i) in fingerTargetsPos"
      :key="'ft-' + i"
      class="ng-finger"
      :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
    >
      <div class="ng-finger-ripple" />
      <div class="ng-finger-icon ng-finger-icon--tilted">👆</div>
    </div>
  </Teleport>

  <!-- 单气泡模式 -->
  <Teleport v-if="active && !bubbles" to="body">
    <div
      class="ng-text-box ng-text-box--card"
      :class="{
        'ng-text-box--orange-icon': iconStyle === 'orange',
        'ng-text-box--glow': cardGlow,
      }"
      :style="{ top: textBoxTop + 'px', marginLeft: textBoxMarginLeft ? textBoxMarginLeft + 'px' : undefined }"
      @click="onExit"
    >
      <!-- Step 标签徽章 -->
      <span v-if="stepLabel" class="ng-step-badge">{{ stepLabel }}</span>
      <!-- 头部徽标行：sparkle + Step X of Y 胶囊（替代 icon+title 模式） -->
      <div v-if="headerBadge" class="ng-header-badge-row">
        <span class="ng-header-badge-icon">{{ icon }}</span>
        <span class="ng-header-badge-pill">{{ headerBadge }}</span>
      </div>
      <div class="ng-text-box-row">
        <span v-if="iconStyle === 'orange' || (!headerBadge && !stepLabel)" class="ng-text-box-icon">
          <img v-if="iconStyle === 'orange'" :src="assetUrl('icons/gold_coin.svg')" alt="" width="28" height="28">
          <template v-else>{{ icon }}</template>
        </span>
        <span class="ng-text-main">{{ mainText }}</span>
      </div>
      <p v-if="subText" class="ng-text-sub ng-text-sub--card">{{ subText }}</p>
      <p v-if="extraText" class="ng-text-extra ng-text-extra--orange">{{ extraText }}</p>
      <div
        :class="[
          textPosition === 'below' ? 'ng-text-box-arrow--up' : 'ng-text-box-arrow',
          arrowX != null ? '' : (extraText ? 'ng-text-box-arrow--x75' : ''),
        ]"
        :style="arrowX != null ? { left: (arrowX * 100) + '%', transform: 'translateX(-50%)' } : undefined"
      />
      <!-- 气泡右侧弧形虚线箭头（绝对定位，锚定气泡右上角） -->
      <svg
        v-if="curvePath"
        class="ng-bubble-curve-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker
            id="ng-arrowhead-curve"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#ec5b13" />
          </marker>
        </defs>
        <path
          :d="curvePath"
          fill="none"
          stroke="#ec5b13"
          stroke-width="2"
          stroke-dasharray="5 4"
          stroke-linecap="round"
          marker-end="url(#ng-arrowhead-curve)"
        />
      </svg>
    </div>
  </Teleport>
</template>
