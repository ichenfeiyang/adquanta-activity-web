/**
 * 新手引导状态管理
 * 使用 localStorage 持久化，满足 PRD「退出后不再触发」要求
 */

const STORAGE_KEY = 'novice_guide_completed_v2';

function storageKey(scope = '') {
  const normalized = String(scope || '').trim();
  return normalized ? `${STORAGE_KEY}:${encodeURIComponent(normalized)}` : STORAGE_KEY;
}

export function isNoviceGuideCompleted(scope = '') {
  return localStorage.getItem(storageKey(scope)) === 'true';
}

export function markNoviceGuideCompleted(scope = '') {
  localStorage.setItem(storageKey(scope), 'true');
}
