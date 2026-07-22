/**
 * 新手引导状态管理
 * 使用 localStorage 持久化，满足 PRD「退出后不再触发」要求
 */

const STORAGE_KEY = 'novice_guide_completed';

export function isNoviceGuideCompleted() {
  // TODO: 开发调试用，始终返回 false，每次刷新都重新进入新手引导
  return false;
  // return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function markNoviceGuideCompleted() {
  // TODO: 开发调试用，禁用持久化
  // localStorage.setItem(STORAGE_KEY, 'true');
}
