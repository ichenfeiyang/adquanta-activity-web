/**
 * create-novice-guide.js
 *
 * 新手引导流程控制器
 * 职责：管理欢迎弹窗 → Step 1 ~ 4 → 完成弹窗 的完整流程
 * 通过 Vue createApp 将组件挂载到 body，实现无侵入式集成
 */
import { createApp, reactive, h } from 'vue';
import { t } from '../i18n/activity-locale.js';
import { markNoviceGuideCompleted } from './novice-guide-state.js';
import { GUIDE_STEPS, CHECKIN_STEP, SPIN_STEP, COINRAIN_STEP, BALANCE_STEP, getNextStep } from './novice-guide-flow.js';
import NoviceGuideWelcome from '../../components/NoviceGuideWelcome.vue';
import NoviceGuideOverlay from '../../components/NoviceGuideOverlay.vue';
import NoviceGuideComplete from '../../components/NoviceGuideComplete.vue';

function createStepConfig(stepKey) {
  if (stepKey === GUIDE_STEPS.STEP_CHECKIN) return CHECKIN_STEP;
  if (stepKey === GUIDE_STEPS.STEP_SPIN) return SPIN_STEP;
  if (stepKey === GUIDE_STEPS.STEP_COINRAIN) return COINRAIN_STEP;
  if (stepKey === GUIDE_STEPS.STEP_BALANCE) return BALANCE_STEP;
  return null;
}

/**
 * @param {object} opts
 * @param {Function} opts.onStepAction  - 点击高亮按钮时触发（由调用方执行正常业务流程）
 * @param {Function} opts.onComplete    - 引导全部完成时回调
 * @returns {{ start: Function, handleSigninDismiss: Function, dispose: Function }}
 */
export function createNoviceGuide({ onStepAction, onComplete }) {
  const state = reactive({
    showWelcome:    false,
    showOverlay:    false,
    showComplete:   false,
    overlaySelector:     '',
    overlayAction:       '',
    overlayMain:         '',
    overlaySub:          '',
    overlayExtra:        '',
    overlayBubbles:      null,
    overlayBubblesContainerSelector: '',
    overlayTextPosition: 'above',
    overlayIcon: '🎬',
    overlayIconStyle: '',
    overlayStepLabel: '',
    overlayFingerTargets: null,
  });

  let currentStep   = null;
  let isGuideActive = false;
  let stepAdvanceTimer = null;
  let stepActionCleanup = null;

  function clearStepTimers() {
    if (stepAdvanceTimer) {
      clearTimeout(stepAdvanceTimer);
      stepAdvanceTimer = null;
    }
    if (stepActionCleanup) {
      stepActionCleanup();
      stepActionCleanup = null;
    }
  }

  // ---------- 内部：启动指定步骤 ----------
  function enterStep(stepKey) {
    clearStepTimers();
    const cfg = createStepConfig(stepKey);
    if (!cfg) {
      // 步骤未实现，直接标记完成
      finishGuide();
      return;
    }
    currentStep = stepKey;
    state.overlaySelector = cfg.highlightSelector;
    state.overlayAction   = cfg.actionSelector;
    state.overlayMain     = t(cfg.guideTextKey);
    state.overlaySub      = cfg.guideSubtextKey ? t(cfg.guideSubtextKey) : '';
    state.overlayExtra    = cfg.guideExtraKey   ? t(cfg.guideExtraKey)   : '';
    state.overlayTextPosition = cfg.textPosition || 'above';
    state.overlayIcon = cfg.guideIcon || '🎬';
    state.overlayIconStyle = cfg.guideIconStyle || '';
    state.overlayStepLabel = cfg.guideStepLabelKey ? t(cfg.guideStepLabelKey) : '';
    state.overlayFingerTargets = cfg.fingerTargets || null;

    // Step 4 特殊处理：给余额卡片添加外发光
    removeCardGlow();
    if (stepKey === GUIDE_STEPS.STEP_BALANCE) {
      const balanceCard = document.querySelector('.tc-balance-card');
      if (balanceCard) balanceCard.classList.add('tc-balance-card--glow');
    }

    // 确保引导目标按钮可点击（初始化时按钮可能处于 disabled 状态）
    if (cfg.actionSelector) {
      const actionBtn = document.querySelector(cfg.actionSelector);
      if (actionBtn) {
        actionBtn.disabled = false;
        actionBtn.removeAttribute('aria-disabled');
      }
    }

    // 多气泡模式：翻译每个气泡的文案
    if (cfg.bubbles) {
      state.overlayBubbles = cfg.bubbles.map(b => ({
        mainText: t(b.mainTextKey),
        subText:  b.subTextKey ? t(b.subTextKey) : '',
        highlightSelector: b.highlightSelector,
        offset: b.offset || 0,
      }));
      state.overlayBubblesContainerSelector = cfg.bubblesContainerSelector || '';
    } else {
      state.overlayBubbles = null;
      state.overlayBubblesContainerSelector = '';
    }

    state.showWelcome  = false;
    state.showOverlay  = true;
    state.showComplete = false;

    // 用户点击目标按钮后：仅隐藏 overlay
    // 推进逻辑完全由各步骤的 dismiss 回调负责（弹窗关闭或 API 失败时调用）
    if (cfg.actionSelector) {
      const actionBtn = document.querySelector(cfg.actionSelector);
      if (actionBtn) {
        const onActionClick = () => {
          if (!isGuideActive || currentStep !== stepKey) return;
          state.showOverlay = false;
        };
        actionBtn.addEventListener('click', onActionClick);
        stepActionCleanup = () => {
          actionBtn.removeEventListener('click', onActionClick);
        };
      }
    }
  }

  // ---------- 内部：完成引导 ----------
  function finishGuide() {
    clearStepTimers();
    currentStep   = null;
    isGuideActive = false;
    state.showWelcome  = false;
    state.showOverlay  = false;
    state.showComplete = true;
  }

  // ---------- 内部：彻底关闭并清理 ----------
  function finalize() {
    clearStepTimers();
    removeCardGlow();
    isGuideActive = false;
    state.showWelcome  = false;
    state.showOverlay  = false;
    state.showComplete = false;
    markNoviceGuideCompleted();
    if (onComplete) onComplete();
    setTimeout(dispose, 50);
  }

  // ---------- 覆盖层 DOM ----------
  let app = null;
  let container = null;

  function mount() {
    container = document.createElement('div');
    container.id = 'novice-guide-root';
    document.body.appendChild(container);

    app = createApp({
      setup() {
        return () => h('div', null, [
          h(NoviceGuideWelcome, {
            visible: state.showWelcome,
            onSkip: handleSkip,
            onStart: handleStart,
          }),
          h(NoviceGuideOverlay, {
            active: state.showOverlay,
            selector: state.overlaySelector,
            actionSelector: state.overlayAction,
            mainText: state.overlayMain,
            subText: state.overlaySub,
            extraText: state.overlayExtra,
            bubbles: state.overlayBubbles,
            bubblesContainerSelector: state.overlayBubblesContainerSelector,
            textPosition: state.overlayTextPosition,
            icon: state.overlayIcon,
            iconStyle: state.overlayIconStyle,
            stepLabel: state.overlayStepLabel,
            fingerTargets: state.overlayFingerTargets,
            onExit: handleOverlayExit,
          }),
          h(NoviceGuideComplete, {
            visible: state.showComplete,
            onDone: finalize,
          }),
        ]);
      },
    });
    app.mount(container);
  }

  function dispose() {
    if (app) {
      app.unmount();
      app = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
      container = null;
    }
  }

  // ---------- 事件处理 ----------
  function handleSkip() {
    finalize();
  }

  function handleStart() {
    isGuideActive = true;
    state.showWelcome = false;
    enterStep(GUIDE_STEPS.STEP_CHECKIN);
  }

  function handleExit() {
    finalize();
  }

  function handleOverlayExit() {
    if (currentStep === GUIDE_STEPS.STEP_BALANCE) {
      handleBalanceDismiss();
    } else {
      handleExit();
    }
  }

  // ---------- 签到弹框关闭回调 ----------
  // initActivityCenter.js 会在签到弹框关闭时调用此方法
  function handleSigninDismiss() {
    if (!isGuideActive || currentStep !== GUIDE_STEPS.STEP_CHECKIN) return false;
    clearStepTimers();
    // 跳过未实现的步骤，寻找下一个有效步骤
    let next = getNextStep(currentStep);
    while (next && !createStepConfig(next)) {
      next = getNextStep(next);
    }
    if (next) {
      enterStep(next);
    } else {
      finishGuide();
    }
    return true;
  }

  // ---------- 转盘弹框关闭回调 ----------
  // initActivityCenter.js 会在转盘弹窗关闭时调用此方法
  function handleSpinDismiss() {
    if (!isGuideActive || currentStep !== GUIDE_STEPS.STEP_SPIN) return false;
    clearStepTimers();
    // 跳过未实现的步骤（如 coinrain），寻找下一个有效步骤
    let next = getNextStep(currentStep);
    while (next && !createStepConfig(next)) {
      next = getNextStep(next);
    }
    if (next) {
      enterStep(next);
    } else {
      finishGuide();
    }
    return true;
  }

  // ---------- 余额引导关闭回调 ----------
  // Step 4 用户点击蒙层退出时由 NoviceGuideOverlay 触发
  function handleBalanceDismiss() {
    if (!isGuideActive || currentStep !== GUIDE_STEPS.STEP_BALANCE) return false;
    clearStepTimers();
    removeCardGlow();
    state.showOverlay = false;
    finishGuide();
    return true;
  }

  // ---------- 移除余额卡片外发光 ----------
  function removeCardGlow() {
    const balanceCard = document.querySelector('.tc-balance-card');
    if (balanceCard) balanceCard.classList.remove('tc-balance-card--glow');
  }

  function isGuideRunning() {
    return isGuideActive;
  }

  return {
    start() { mount(); state.showWelcome = true; },
    handleSigninDismiss,
    handleSpinDismiss,
    handleBalanceDismiss,
    isGuideRunning,
    dispose,
  };
}
