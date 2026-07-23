/**
 * 新手引导状态管理
 * 使用 localStorage 持久化，满足 PRD「退出后不再触发」要求
 */

const STORAGE_KEY = 'novice_guide_completed';

export function isNoviceGuideCompleted() {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function markNoviceGuideCompleted() {
  localStorage.setItem(STORAGE_KEY, 'true');
}
