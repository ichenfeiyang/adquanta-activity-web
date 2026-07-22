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
