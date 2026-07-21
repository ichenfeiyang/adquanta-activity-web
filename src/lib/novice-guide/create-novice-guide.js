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
import { GUIDE_STEPS, CHECKIN_STEP, getNextStep } from './novice-guide-flow.js';
import NoviceGuideWelcome from '../../components/NoviceGuideWelcome.vue';
import NoviceGuideOverlay from '../../components/NoviceGuideOverlay.vue';
import NoviceGuideComplete from '../../components/NoviceGuideComplete.vue';

function createStepConfig(stepKey) {
  if (stepKey === GUIDE_STEPS.STEP_CHECKIN) return CHECKIN_STEP;
  return null; // Step 2~4 尚未实现
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
  });

  let currentStep   = null;
  let isGuideActive = false;

  // ---------- 内部：启动指定步骤 ----------
  function enterStep(stepKey) {
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
    state.showWelcome  = false;
    state.showOverlay  = true;
    state.showComplete = false;
  }

  // ---------- 内部：完成引导 ----------
  function finishGuide() {
    currentStep   = null;
    isGuideActive = false;
    state.showWelcome  = false;
    state.showOverlay  = false;
    state.showComplete = true;
  }

  // ---------- 内部：彻底关闭并清理 ----------
  function finalize() {
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
            textPosition: 'above',
            onExit: handleExit,
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

  // ---------- 签到弹框关闭回调 ----------
  // initActivityCenter.js 会在签到弹框关闭时调用此方法
  function handleSigninDismiss() {
    if (!isGuideActive || currentStep !== GUIDE_STEPS.STEP_CHECKIN) return false;
    const next = getNextStep(currentStep);
    if (next) {
      enterStep(next);
    } else {
      finishGuide();
    }
    return true; // 已消费，调用方无需执行原始逻辑
  }

  function isGuideRunning() {
    return isGuideActive;
  }

  return {
    start() { mount(); state.showWelcome = true; },
    handleSigninDismiss,
    isGuideRunning,
    dispose,
  };
}
