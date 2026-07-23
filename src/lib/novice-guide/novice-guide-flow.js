/**
 * 新手引导步骤定义
 * 当前仅实现 Step 1（签到引导），Step 2~4 预留配置
 */

export const GUIDE_STEPS = {
  WELCOME: 'welcome',
  STEP_CHECKIN: 'checkin',
  STEP_SPIN: 'spin',
  STEP_COINRAIN: 'coinrain',
  STEP_BALANCE: 'balance',
  COMPLETED: 'completed',
};

const STEP_ORDER = [
  GUIDE_STEPS.STEP_CHECKIN,
  GUIDE_STEPS.STEP_SPIN,
  GUIDE_STEPS.STEP_COINRAIN,
  GUIDE_STEPS.STEP_BALANCE,
];

export function getNextStep(current) {
  const idx = STEP_ORDER.indexOf(current);
  if (idx === -1 || idx >= STEP_ORDER.length - 1) return null;
  return STEP_ORDER[idx + 1];
}

/** Step 1 配置 */
export const CHECKIN_STEP = {
  step: GUIDE_STEPS.STEP_CHECKIN,
  highlightSelector: '#tc-daily-checkin-section',
  actionSelector: '#signin-timer-btn',
  // 单气泡模式文案（向后兼容）
  guideTextKey: 'novice.step1.text',
  guideSubtextKey: 'novice.step1.subtext',
  guideExtraKey: 'novice.step1.chestTip',
  // 多气泡模式：两个独立白色指引气泡
  bubblesContainerSelector: '#tc-daily-checkin-section',
  bubbles: [
    {
      mainTextKey: 'novice.step1.text',
      subTextKey: 'novice.step1.subtext',
      highlightSelector: '#signin-timer-btn',
    },
    {
      mainTextKey: 'novice.step1.chestTip',
      subTextKey: 'novice.step1.chestSubtext',
      highlightSelector: '#tc-checkin-days-container [data-day="7"]',
    },
  ],
};

/** Step 2 配置 */
export const SPIN_STEP = {
  step: GUIDE_STEPS.STEP_SPIN,
  highlightSelector: '#tc-lucky-spin-section',
  actionSelector: '#btn-watch-ad',
  cardGlowSelector: '#tc-lucky-spin-section .tc-card',
  guideTextKey: 'novice.step2.text',
  guideSubtextKey: 'novice.step2.subtext',
  guideIcon: '✨',
  headerBadge: 'Step 2 of 3',
  arrowPosition: 'dynamic',
  highlightGlow: true,
  textPosition: 'above',
};

/** Step 3 配置 — Daily Coin Rain */
export const COINRAIN_STEP = {
  step: GUIDE_STEPS.STEP_COINRAIN,
  highlightSelector: '#tc-coin-rain-section',
  actionSelector: '#tc-coin-rain-entry',
  guideTextKey: 'novice.step3.text',
  guideSubtextKey: 'novice.step3.subtext',
  guideIcon: '💰',
  textPosition: 'above',
};

/** Step 4 配置 */
export const BALANCE_STEP = {
  step: GUIDE_STEPS.STEP_BALANCE,
  highlightSelector: '#tc-checkin-section',
  guideTextKey: 'novice.step4.text',
  guideSubtextKey: 'novice.step4.subtext',
  guideStepLabelKey: 'novice.step4.stepLabel',
  guideIcon: '🪙',
  guideIconStyle: 'orange',   // 橙色圆形背景
  textPosition: 'below',
  // Step 4 手指指向元素
  fingerTargets: [
    { selector: '#goldCoins', offsetX: 0, offsetY: -30 },
  ],
};
